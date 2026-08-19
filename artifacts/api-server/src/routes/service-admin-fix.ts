import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();
const quote = (value: unknown) => value === null || value === undefined ? "NULL" : typeof value === "number" ? String(value) : typeof value === "boolean" ? (value ? "TRUE" : "FALSE") : `'${String(value).replace(/'/g, "''")}'`;

async function ensurePackageItemsTable() {
  await db.execute(sql.raw(`CREATE TABLE IF NOT EXISTS smp_package_items (
    id SERIAL PRIMARY KEY,
    package_id INTEGER NOT NULL REFERENCES smp_packages(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL REFERENCES smp_services(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (package_id, service_id)
  )`));
}

router.post("/admin/services", async (req, res) => {
  const data = req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};
  const name = String(data.name ?? "").trim().replace(/\s+/g, " ");
  const code = String(data.code ?? "").trim();
  const isFree = data.is_free === true || String(data.is_free ?? "").toLowerCase() === "true";
  const urgentAllowed = data.urgent_allowed === true || String(data.urgent_allowed ?? "").toLowerCase() === "true";
  const price = isFree ? 0 : Number(data.price);
  const urgentPrice = urgentAllowed && data.urgent_price !== null && data.urgent_price !== undefined && data.urgent_price !== "" ? Number(data.urgent_price) : null;
  const normalDeliveryDays = Number(data.normal_delivery_days);
  const urgentDeliveryDays = urgentAllowed && data.urgent_delivery_days !== null && data.urgent_delivery_days !== undefined && data.urgent_delivery_days !== "" ? Number(data.urgent_delivery_days) : null;
  const description = data.description ? String(data.description).trim() : null;
  const status = String(data.status ?? "").trim().toUpperCase();
  if (!name) return res.status(400).json({ error: "Service name is required." });
  if (!code) return res.status(400).json({ error: "Code is required." });
  if (!Number.isFinite(price) || price < 0) return res.status(400).json({ error: "Price must be a number greater than or equal to 0." });
  if (!Number.isInteger(normalDeliveryDays) || normalDeliveryDays < 0) return res.status(400).json({ error: "Normal delivery days must be a whole number greater than or equal to 0." });
  if (!["ACTIVE", "INACTIVE"].includes(status)) return res.status(400).json({ error: "Status must be Active or Not Active." });
  if (urgentAllowed && (urgentPrice === null || !Number.isFinite(urgentPrice) || urgentDeliveryDays === null || !Number.isInteger(urgentDeliveryDays) || urgentDeliveryDays < 0 || urgentDeliveryDays > normalDeliveryDays)) return res.status(400).json({ error: "Invalid urgent pricing or delivery settings." });
  try {
    const existing = await db.execute(sql.raw(`SELECT id FROM smp_services WHERE code = ${quote(code)} LIMIT 1`));
    if (existing.rows.length) return res.status(409).json({ error: "Code already exists." });
    const result = await db.execute(sql.raw(`INSERT INTO smp_services (name, code, price, is_free, urgent_allowed, urgent_price, normal_delivery_days, urgent_delivery_days, description, status) VALUES (${quote(name)}, ${quote(code)}, ${quote(price)}, ${quote(isFree)}, ${quote(urgentAllowed)}, ${quote(urgentPrice)}, ${quote(normalDeliveryDays)}, ${quote(urgentDeliveryDays)}, ${quote(description)}, ${quote(status)}) RETURNING *`));
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    req.log.error({ err: error, serviceCode: code, serviceName: name }, "Service create failed");
    return res.status(500).json({ error: "Failed to create service.", details: error instanceof Error ? error.message : String(error) });
  }
});

router.get("/admin/packages/:id/services", async (req, res) => {
  try {
    await ensurePackageItemsTable();
    const packageId = Number(req.params.id);
    const result = await db.execute(sql.raw(`SELECT pi.id, pi.package_id, pi.service_id, pi.quantity, s.name, s.code, s.price, s.is_free, s.urgent_allowed, s.urgent_price, s.normal_delivery_days, s.urgent_delivery_days FROM smp_package_items pi JOIN smp_services s ON s.id = pi.service_id WHERE pi.package_id = ${packageId} ORDER BY pi.id ASC`));
    return res.json(result.rows);
  } catch (error) { req.log.error({ err: error }, "Package services load failed"); return res.status(500).json({ error: "Failed to load package services." }); }
});

router.put("/admin/packages/:id/services", async (req, res) => {
  try {
    await ensurePackageItemsTable();
    const packageId = Number(req.params.id);
    if (!Number.isInteger(packageId) || packageId <= 0) return res.status(400).json({ error: "Invalid package id." });
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const packageCheck = await db.execute(sql.raw(`SELECT id FROM smp_packages WHERE id = ${packageId} LIMIT 1`));
    if (!packageCheck.rows.length) return res.status(404).json({ error: "Package not found." });
    const normalized = items.map((item: any) => ({ serviceId: Number(item.service_id ?? item.serviceId), quantity: Number(item.quantity) })).filter((item: any) => Number.isInteger(item.serviceId) && item.serviceId > 0 && Number.isInteger(item.quantity) && item.quantity > 0);
    const serviceIds = normalized.map((item: any) => item.serviceId);
    if (serviceIds.length) {
      const check = await db.execute(sql.raw(`SELECT id FROM smp_services WHERE status = 'ACTIVE' AND id IN (${serviceIds.join(",")})`));
      if (check.rows.length !== new Set(serviceIds).size) return res.status(400).json({ error: "One or more selected services are invalid or inactive." });
    }
    await db.execute(sql.raw(`DELETE FROM smp_package_items WHERE package_id = ${packageId}`));
    for (const item of normalized) await db.execute(sql.raw(`INSERT INTO smp_package_items (package_id, service_id, quantity) VALUES (${packageId}, ${item.serviceId}, ${item.quantity})`));
    const result = await db.execute(sql.raw(`SELECT pi.id, pi.package_id, pi.service_id, pi.quantity, s.name, s.code, s.price, s.is_free, s.urgent_allowed, s.urgent_price, s.normal_delivery_days, s.urgent_delivery_days FROM smp_package_items pi JOIN smp_services s ON s.id = pi.service_id WHERE pi.package_id = ${packageId} ORDER BY pi.id ASC`));
    return res.json(result.rows);
  } catch (error) { req.log.error({ err: error }, "Package services save failed"); return res.status(500).json({ error: "Failed to save package services.", details: error instanceof Error ? error.message : String(error) }); }
});

router.get("/reception/catalog", async (_req, res) => {
  try {
    await ensurePackageItemsTable();
    const services = await db.execute(sql.raw(`SELECT id, name, code, price, is_free, urgent_allowed, urgent_price, normal_delivery_days, urgent_delivery_days, description FROM smp_services WHERE status = 'ACTIVE' ORDER BY name ASC, id ASC`));
    const packages = await db.execute(sql.raw(`SELECT p.id, p.name, p.code, p.price, p.description, COALESCE(jsonb_agg(jsonb_build_object('service_id', pi.service_id, 'quantity', pi.quantity, 'name', s.name, 'code', s.code, 'price', s.price, 'urgent_allowed', s.urgent_allowed, 'urgent_price', s.urgent_price, 'normal_delivery_days', s.normal_delivery_days, 'urgent_delivery_days', s.urgent_delivery_days)) FILTER (WHERE pi.id IS NOT NULL), '[]'::jsonb) AS services FROM smp_packages p LEFT JOIN smp_package_items pi ON pi.package_id = p.id LEFT JOIN smp_services s ON s.id = pi.service_id WHERE p.status = 'ACTIVE' GROUP BY p.id ORDER BY p.name ASC, p.id ASC`));
    return res.json({ services: services.rows, packages: packages.rows });
  } catch (error) { _req.log.error({ err: error }, "Reception catalog load failed"); return res.status(500).json({ error: "Failed to load reception catalog." }); }
});

export default router;
