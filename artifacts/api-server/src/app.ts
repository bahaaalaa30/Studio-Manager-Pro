import express from "express";
import cors from "cors";
import pinoHttpModule from "pino-http";
const pinoHttp = pinoHttpModule as unknown as typeof import("pino-http").default;
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";
import { ensureDatabaseSchema } from "@workspace/db";
import { getAuthenticatedUser, getUserPermissions } from "./routes/auth.js";

const app = express();

app.use(pinoHttp({
  logger,
  serializers: {
    req(req: { id: any; method: any; url: string }) { return { id: req.id, method: req.method, url: req.url?.split("?")[0] }; },
    res(res: { statusCode: number }) { return { statusCode: res.statusCode }; },
  },
}));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Reception customer validation: keep the API as the final source of truth.
app.use((req, res, next) => {
  if (req.method === "POST" && req.path === "/api/orders") {
    const name = typeof req.body?.customerName === "string" ? req.body.customerName.trim().replace(/\s+/g, " ") : "";
    const mobile = typeof req.body?.customerMobile === "string" ? req.body.customerMobile.trim() : "";
    const namePattern = /^[A-Za-z\u0600-\u06FF]+(?:[ '\-][A-Za-z\u0600-\u06FF]+)+$/;
    const mobilePattern = /^01\d{9}$/;
    if (typeof req.body?.customerName === "string") req.body.customerName = name;
    if (!name) return res.status(400).json({ error: "Name is required." });
    if (!namePattern.test(name)) return res.status(400).json({ error: "Enter a valid Arabic or English name with at least two parts." });
    if (!mobile) return res.status(400).json({ error: "Mobile number is required." });
    if (!/^\d+$/.test(mobile)) return res.status(400).json({ error: "Mobile number must contain numbers only." });
    if (!mobilePattern.test(mobile)) return res.status(400).json({ error: "Mobile number must start with 01 and contain 11 digits." });
  }
  next();
});

app.use(async (_req, res, next) => {
  try { await ensureDatabaseSchema(); next(); }
  catch (error) { logger.error({ err: error }, "Database schema initialization failed"); res.status(500).json({ error: "Database initialization failed" }); }
});

// RBAC enforcement for the administration API. The UI can hide actions, but
// this middleware is the final authorization boundary for direct API calls.
const adminPermission = (method: string, path: string): string | null => {
  const match = path.match(/^\/api\/admin\/([^/]+)/);
  if (!match) return null;
  const resource = match[1];
  if (path.includes("/permissions")) {
    if (resource === "roles") return "roles.manage";
    if (resource === "users") return "users.edit";
  }
  if (path === "/api/admin/options/users") return "users.view";
  if (resource === "branches") return "branches.manage";
  if (resource === "roles") return "roles.manage";
  if (resource === "permissions") return "permissions.manage";
  if (resource === "services") return "services.manage";
  if (resource === "packages") return "packages.manage";
  if (resource === "inventory") return method === "GET" ? "inventory.view" : "inventory.manage";
  if (resource === "users") {
    if (method === "GET") return "users.view";
    if (method === "POST") return "users.create";
    if (method === "PATCH") return "users.edit";
    if (method === "DELETE") return "users.delete";
  }
  return null;
};

app.use(async (req, res, next) => {
  if (!req.path.startsWith("/api/admin")) return next();
  const required = adminPermission(req.method, req.path);
  if (!required) return next();
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ error: "Not authenticated" });
    const permissions = await getUserPermissions(Number(user.id));
    const allowed = permissions.some((permission) => String((permission as { key?: unknown }).key) === required);
    if (!allowed) return res.status(403).json({ error: "Forbidden", requiredPermission: required });
    next();
  } catch (error) {
    logger.error({ err: error }, "Authorization check failed");
    res.status(500).json({ error: "Authorization check failed" });
  }
});

function calculateExpectedDeliveryTime(order: { services?: Array<{ serviceType?: string }>; createdAt?: string | Date; expectedDeliveryTime?: string | Date | null }) {
  if (order.expectedDeliveryTime) return order.expectedDeliveryTime instanceof Date ? order.expectedDeliveryTime.toISOString() : order.expectedDeliveryTime;
  if (!order.createdAt || !Array.isArray(order.services)) return null;
  const hasPersonal = order.services.some((s) => s.serviceType === "personal_photos_8pack");
  const hasCard = order.services.some((s) => s.serviceType === "card_photos_1pack");
  const isUrgent = order.services.some((s) => s.serviceType === "urgent_fee");
  let days = 0;
  if (hasPersonal && hasCard) days = isUrgent ? 1 : 2;
  else if (hasPersonal) days = isUrgent ? 0 : 1;
  else if (hasCard) days = isUrgent ? 1 : 2;
  const deliveryDate = new Date(order.createdAt); deliveryDate.setDate(deliveryDate.getDate() + days); return deliveryDate.toISOString();
}
function enrichOrderResponse(body: unknown): unknown {
  if (Array.isArray(body)) return body.map(enrichOrderResponse);
  if (body && typeof body === "object" && "orderNumber" in body && "services" in body) {
    const order = body as { expectedDeliveryTime?: string | Date | null; services?: Array<{ serviceType?: string }>; createdAt?: string | Date };
    return { ...(body as Record<string, unknown>), expectedDeliveryTime: calculateExpectedDeliveryTime(order) };
  }
  return body;
}
app.use((req, res, next) => {
  if (!req.path.startsWith("/api/orders")) return next();
  const originalJson = res.json.bind(res);
  res.json = ((body: unknown) => originalJson(enrichOrderResponse(body))) as typeof res.json;
  next();
});

app.use("/api", router);
export default app;
