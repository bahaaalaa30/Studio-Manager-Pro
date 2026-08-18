import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { createHmac, timingSafeEqual, scryptSync } from "node:crypto";

const router = Router();
const SESSION_COOKIE = "smp_session";
const SESSION_SECRET = process.env.SMP_SESSION_SECRET ?? process.env.SESSION_SECRET ?? "change-this-in-production";

const b64url = (value: string) => Buffer.from(value).toString("base64url");
const sign = (value: string) => createHmac("sha256", SESSION_SECRET).update(value).digest("base64url");
const verifyPassword = (password: string, stored: string) => {
  const [salt, expectedHex] = stored.split(":");
  if (!salt || !expectedHex) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, "hex");
  return expected.length === actual.length && timingSafeEqual(actual, expected);
};
const createSession = (userId: number) => {
  const payload = b64url(JSON.stringify({ sub: userId, exp: Date.now() + 8 * 60 * 60 * 1000 }));
  return `${payload}.${sign(payload)}`;
};
const readSession = (value?: string) => {
  if (!value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature || sign(payload) !== signature) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { sub?: number; exp?: number };
    return typeof data.sub === "number" && typeof data.exp === "number" && data.exp > Date.now() ? data.sub : null;
  } catch { return null; }
};
const parseCookies = (header?: string) => Object.fromEntries((header ?? "").split(";").filter(Boolean).map((part) => {
  const index = part.indexOf("=");
  return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
}));

export async function getAuthenticatedUser(req: { headers: { cookie?: string } }) {
  const userId = readSession(parseCookies(req.headers.cookie)[SESSION_COOKIE]);
  if (!userId) return null;
  const result = await db.execute(sql.raw(`SELECT u.id, u.name, u.username, u.role_id, u.branch_id, b.name AS branch_name, u.status, u.must_change_password, r.name AS role_name
    FROM smp_users u LEFT JOIN smp_roles r ON r.id = u.role_id LEFT JOIN smp_branches b ON b.id = u.branch_id WHERE u.id = ${userId} AND u.status = 'ACTIVE' LIMIT 1`));
  return result.rows[0] ?? null;
}

export async function getUserPermissions(userId: number) {
  const result = await db.execute(sql.raw(`SELECT DISTINCT p.key, p.name, p.module, p.action
    FROM smp_permissions p
    JOIN smp_role_permissions rp ON rp.permission_id = p.id
    JOIN smp_users u ON u.role_id = rp.role_id AND u.id = ${userId}
    LEFT JOIN smp_user_permissions up ON up.permission_id = p.id AND up.user_id = ${userId}
    WHERE COALESCE(up.granted, TRUE) = TRUE
    UNION
    SELECT p.key, p.name, p.module, p.action
    FROM smp_user_permissions up JOIN smp_permissions p ON p.id = up.permission_id
    WHERE up.user_id = ${userId} AND up.granted = TRUE`));
  return result.rows;
}

router.post("/auth/login", async (req, res) => {
  const username = String(req.body?.username ?? "").trim();
  const password = String(req.body?.password ?? "");
  if (!username || !password) return res.status(400).json({ error: "Username and password are required" });
  try {
    const safeUsername = username.replace(/'/g, "''");
    const result = await db.execute(sql.raw(`SELECT u.*, r.name AS role_name FROM smp_users u LEFT JOIN smp_roles r ON r.id = u.role_id WHERE LOWER(u.username) = LOWER('${safeUsername}') LIMIT 1`));
    const user = result.rows[0] as Record<string, any> | undefined;
    if (!user || user.status !== "ACTIVE" || !user.password_hash) return res.status(401).json({ error: "Invalid username or password" });
    if (user.locked_until && new Date(String(user.locked_until)).getTime() > Date.now()) return res.status(423).json({ error: "Account temporarily locked" });
    if (!verifyPassword(password, String(user.password_hash))) {
      const attempts = Number(user.failed_login_attempts ?? 0) + 1;
      const lock = attempts >= 5 ? "NOW() + INTERVAL '15 minutes'" : "NULL";
      await db.execute(sql.raw(`UPDATE smp_users SET failed_login_attempts = ${attempts}, locked_until = ${lock}, updated_at = NOW() WHERE id = ${Number(user.id)}`));
      return res.status(401).json({ error: "Invalid username or password" });
    }
    await db.execute(sql.raw(`UPDATE smp_users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = NOW(), updated_at = NOW() WHERE id = ${Number(user.id)}`));
    const permissions = await getUserPermissions(Number(user.id));
    const session = createSession(Number(user.id));
    res.setHeader("Set-Cookie", `${SESSION_COOKIE}=${encodeURIComponent(session)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=28800`);
    return res.json({ user: { id: user.id, name: user.name, username: user.username, roleId: user.role_id, role: user.role_name, branchId: user.branch_id, status: user.status, mustChangePassword: user.must_change_password }, permissions });
  } catch (error) { req.log.error({ err: error }, "Login failed"); return res.status(500).json({ error: "Login failed" }); }
});

router.post("/auth/logout", (_req, res) => {
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`);
  return res.status(204).send();
});

router.get("/auth/me", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ error: "Not authenticated" });
    const permissions = await getUserPermissions(Number(user.id));
    return res.json({ user, permissions });
  } catch (error) { req.log.error({ err: error }, "Session lookup failed"); return res.status(500).json({ error: "Failed to load session" }); }
});

export default router;
