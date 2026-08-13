import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { randomBytes, scryptSync } from "node:crypto";

const router = Router();
const resources = {
  users: { table: "smp_users", columns: ["name", "username", "role_id", "branch_id", "status"] },
  branches: { table: "smp_branches", columns: ["name", "code", "address", "phone", "manager_user_id", "status"] },
  roles: { table: "smp_roles", columns: ["name", "description", "status"] },
  permissions: { table: "smp_permissions", columns: ["key", "name", "module", "action", "description"] },
  services: { table: "smp_services", columns: ["name", "code", "price", "description", "status"] },
  packages: { table: "smp_packages", columns: ["name", "code", "price", "description", "status"] },
  inventory: { table: "smp_inventory_items", columns: ["name", "sku", "category", "unit", "quantity", "minimum_quantity", "status"] },
} as const;
type Resource = keyof typeof resources;
const getResource = (value: string) => (value in resources ? resources[value as Resource] : null);
const quote = (value: unknown) => value === null || value === undefined ? "NULL" : typeof value === "number" ? String(value) : typeof value === "boolean" ? (value ? "TRUE" : "FALSE") : `'${String(value).replace(/'/g, "''")}'`;
const hashPassword = (password: string) => {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
};

router.get("/admin/:resource", async (req, res) => {
  const resource = getResource(req.params.resource);
  if (!resource) return res.status(404).json({ error: "Unknown admin resource" });
  try {
    const search = String(req.query.search ?? "").trim().replace(/'/g, "''");
    const where = search ? ` WHERE ${resource.columns.map((c) => `CAST(${c} AS TEXT) ILIKE '%${search}%'`).join(" OR ")}` : "";
    const result = await db.execute(sql.raw(`SELECT * FROM ${resource.table}${where} ORDER BY id DESC LIMIT 200`));
    return res.json(result.rows);
  } catch (error) { req.log.error({ err: error }, "Admin list failed"); return res.status(500).json({ error: "Failed to load admin data" }); }
});

router.post("/admin/:resource", async (req, res) => {
  const resource = getResource(req.params.resource);
  if (!resource) return res.status(404).json({ error: "Unknown admin resource" });
  const data = req.body && typeof req.body === "object" ? req.body : {};

  if (req.params.resource === "users") {
    const { name, username, password, role_id, branch_id, status, must_change_password } = data as Record<string, unknown>;
    if (!name || !username || typeof password !== "string" || password.length < 8) {
      return res.status(400).json({ error: "name, username and a password of at least 8 characters are required" });
    }
    try {
      const result = await db.execute(sql.raw(`INSERT INTO smp_users (name, username, password_hash, password_set_at, must_change_password, role_id, branch_id, status) VALUES (${quote(name)}, ${quote(username)}, ${quote(hashPassword(password))}, NOW(), ${quote(Boolean(must_change_password))}, ${quote(role_id)}, ${quote(branch_id)}, ${quote(status ?? "ACTIVE")}) RETURNING id, name, username, role_id, branch_id, status, must_change_password, password_set_at, last_login_at`));
      return res.status(201).json(result.rows[0]);
    } catch (error) { req.log.error({ err: error }, "User create failed"); return res.status(400).json({ error: "Failed to create user" }); }
  }

  const fields = resource.columns.filter((c) => data[c] !== undefined);
  if (!fields.length) return res.status(400).json({ error: "No valid fields supplied" });
  try {
    const values = fields.map((field) => quote(data[field]));
    const result = await db.execute(sql.raw(`INSERT INTO ${resource.table} (${fields.join(",")}) VALUES (${values.join(",")}) RETURNING *`));
    return res.status(201).json(result.rows[0]);
  } catch (error) { req.log.error({ err: error }, "Admin create failed"); return res.status(400).json({ error: "Failed to create record" }); }
});

router.patch("/admin/:resource/:id", async (req, res) => {
  const resource = getResource(req.params.resource);
  if (!resource) return res.status(404).json({ error: "Unknown admin resource" });
  const data = req.body && typeof req.body === "object" ? req.body : {};
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });

  if (req.params.resource === "users" && typeof data.password === "string") {
    if (data.password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });
    try {
      await db.execute(sql.raw(`UPDATE smp_users SET password_hash = ${quote(hashPassword(data.password))}, password_set_at = NOW(), must_change_password = ${quote(Boolean(data.must_change_password ?? false))}, updated_at = NOW() WHERE id = ${id}`));
      const result = await db.execute(sql.raw(`SELECT id, name, username, role_id, branch_id, status, must_change_password, password_set_at, last_login_at FROM smp_users WHERE id = ${id}`));
      if (!result.rows.length) return res.status(404).json({ error: "Record not found" });
      return res.json(result.rows[0]);
    } catch (error) { req.log.error({ err: error }, "User password update failed"); return res.status(400).json({ error: "Failed to update user password" }); }
  }

  const fields = resource.columns.filter((c) => data[c] !== undefined);
  if (!fields.length) return res.status(400).json({ error: "No valid fields supplied" });
  try {
    const sets = fields.map((field) => `${field} = ${quote(data[field])}`).join(", ");
    const result = await db.execute(sql.raw(`UPDATE ${resource.table} SET ${sets}, updated_at = NOW() WHERE id = ${id} RETURNING *`));
    if (!result.rows.length) return res.status(404).json({ error: "Record not found" });
    return res.json(result.rows[0]);
  } catch (error) { req.log.error({ err: error }, "Admin update failed"); return res.status(400).json({ error: "Failed to update record" }); }
});

router.delete("/admin/:resource/:id", async (req, res) => {
  const resource = getResource(req.params.resource);
  if (!resource) return res.status(404).json({ error: "Unknown admin resource" });
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });
  try {
    const result = await db.execute(sql.raw(`DELETE FROM ${resource.table} WHERE id = ${id} RETURNING id`));
    if (!result.rows.length) return res.status(404).json({ error: "Record not found" });
    return res.status(204).send();
  } catch (error) { req.log.error({ err: error }, "Admin delete failed"); return res.status(400).json({ error: "Failed to delete record" });
  }
});

export default router;
