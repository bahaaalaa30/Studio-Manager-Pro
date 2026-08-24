import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();
const quote = (value: unknown) => value === null || value === undefined ? "NULL" : typeof value === "number" ? String(value) : `'${String(value).replace(/'/g, "''")}'`;
const normalizeText = (value: unknown) => String(value ?? "").trim().replace(/\s+/g, " ");
const numberValue = (value: unknown) => { const n = Number(value); return Number.isFinite(n) ? n : NaN; };
const inventoryStatus = (quantity: number, minimum: number) => quantity <= 0 ? "OUT_OF_STOCK" : quantity < minimum ? "LOW_STOCK" : "IN_STOCK";
const statusSql = `(CASE WHEN quantity <= 0 THEN 'OUT_OF_STOCK' WHEN quantity < minimum_quantity THEN 'LOW_STOCK' ELSE 'IN_STOCK' END)`;
let schemaReady: Promise<void> | null = null;
const ensureInventorySchema = async () => {
  if (!schemaReady) schemaReady = db.execute(sql.raw(`ALTER TABLE smp_inventory_items ALTER COLUMN sku DROP NOT NULL; ALTER TABLE smp_inventory_items ADD COLUMN IF NOT EXISTS unit_price NUMERIC(12,2) NOT NULL DEFAULT 0`)).then(() => undefined).catch((error) => { schemaReady = null; throw error; });
  return schemaReady;
};
function validateInventory(data: Record<string, unknown>) {
  const name = normalizeText(data.name); const category = normalizeText(data.category); const unit = normalizeText(data.unit); const quantity = numberValue(data.quantity); const minimumQuantity = numberValue(data.minimum_quantity); const unitPrice = numberValue(data.unit_price ?? 0);
  if (!name) return "Item Name is required."; if (name.length > 120) return "Item Name cannot exceed 120 characters.";
  if (!category) return "Category is required."; if (category.length > 120) return "Category cannot exceed 120 characters.";
  if (!unit) return "Unit is required."; if (unit.length > 50) return "Unit cannot exceed 50 characters.";
  if (!Number.isInteger(quantity) || quantity < 0) return "In Stock must be a non-negative whole number.";
  if (!Number.isInteger(minimumQuantity) || minimumQuantity < 0) return "Minimum Quantity must be a non-negative whole number.";
  if (!Number.isFinite(unitPrice) || unitPrice < 0) return "Unit Price must be greater than or equal to 0.";
  return null;
}
const selectFields = `id, name, category, unit, quantity, minimum_quantity, unit_price, quantity * unit_price AS value, ${statusSql} AS status`;

router.get("/admin/inventory/categories", async (_req, res) => {
  try { await ensureInventorySchema(); const result = await db.execute(sql.raw("SELECT DISTINCT category FROM smp_inventory_items WHERE category IS NOT NULL AND TRIM(category) <> '' ORDER BY category ASC")); return res.json(result.rows.map((row) => String((row as { category: unknown }).category))); }
  catch { return res.status(500).json({ error: "Failed to load inventory categories" }); }
});

router.get("/admin/inventory/analytics", async (_req, res) => {
  try {
    await ensureInventorySchema();
    const result = await db.execute(sql.raw(`SELECT COUNT(*)::int AS total_items, COUNT(*) FILTER (WHERE quantity > 0 AND quantity < minimum_quantity)::int AS low_stock_items, COUNT(*) FILTER (WHERE quantity <= 0)::int AS out_of_stock_items, COUNT(*) FILTER (WHERE quantity >= minimum_quantity AND quantity > 0)::int AS in_stock_items, COALESCE(SUM(quantity), 0) AS total_quantity, COALESCE(SUM(minimum_quantity), 0) AS total_minimum_quantity, COALESCE(SUM(quantity * unit_price), 0) AS total_value FROM smp_inventory_items`));
    return res.json(result.rows[0] ?? { total_items: 0, low_stock_items: 0, out_of_stock_items: 0, in_stock_items: 0, total_quantity: 0, total_minimum_quantity: 0, total_value: 0 });
  } catch { return res.status(500).json({ error: "Failed to load inventory analytics" }); }
});

router.get("/admin/inventory", async (req, res) => {
  try {
    await ensureInventorySchema();
    const search = String(req.query.search ?? "").trim().replace(/'/g, "''");
    const category = String(req.query.category ?? "").trim().replace(/'/g, "''");
    const status = String(req.query.status ?? "").trim().toUpperCase().replace(/'/g, "''");
    const filters: string[] = [];
    if (search) filters.push(`(name ILIKE '%${search}%' OR category ILIKE '%${search}%' OR unit ILIKE '%${search}%')`);
    if (category && category !== "ALL") filters.push(`category = '${category}'`);
    if (["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"].includes(status)) filters.push(`${statusSql} = '${status}'`);
    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const result = await db.execute(sql.raw(`SELECT ${selectFields} FROM smp_inventory_items ${where} ORDER BY id DESC LIMIT 500`));
    return res.json(result.rows);
  } catch (error) { req.log.error({ err: error }, "Inventory list failed"); return res.status(500).json({ error: "Failed to load inventory" }); }
});

router.post("/admin/inventory", async (req, res) => {
  const data = req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};
  const validation = validateInventory(data); if (validation) return res.status(400).json({ error: validation });
  try {
    await ensureInventorySchema();
    const result = await db.execute(sql.raw(`INSERT INTO smp_inventory_items (name, category, unit, quantity, minimum_quantity, unit_price) VALUES (${quote(normalizeText(data.name))}, ${quote(normalizeText(data.category))}, ${quote(normalizeText(data.unit))}, ${Number(data.quantity)}, ${Number(data.minimum_quantity)}, ${Number(data.unit_price ?? 0)}) RETURNING ${selectFields}`));
    return res.status(201).json(result.rows[0]);
  } catch (error) { req.log.error({ err: error }, "Inventory create failed"); return res.status(400).json({ error: "Failed to create inventory item." }); }
});

router.patch("/admin/inventory/:id", async (req, res) => {
  const id = Number(req.params.id); if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });
  try {
    await ensureInventorySchema();
    const existing = await db.execute(sql.raw(`SELECT id, name, category, unit, quantity, minimum_quantity, unit_price FROM smp_inventory_items WHERE id = ${id} LIMIT 1`));
    if (!existing.rows.length) return res.status(404).json({ error: "Inventory item not found" });
    const merged = { ...(existing.rows[0] as Record<string, unknown>), ...(req.body ?? {}) };
    const validation = validateInventory(merged); if (validation) return res.status(400).json({ error: validation });
    const sets = ["name", "category", "unit", "quantity", "minimum_quantity", "unit_price"].map((field) => `${field} = ${quote(["quantity", "minimum_quantity", "unit_price"].includes(field) ? Number(merged[field]) : normalizeText(merged[field]))}`);
    const result = await db.execute(sql.raw(`UPDATE smp_inventory_items SET ${sets.join(", ")}, updated_at = NOW() WHERE id = ${id} RETURNING ${selectFields}`));
    return res.json(result.rows[0]);
  } catch (error) { req.log.error({ err: error }, "Inventory update failed"); return res.status(400).json({ error: "Failed to update inventory item." }); }
});

router.post("/admin/inventory/:id/adjust", async (req, res) => {
  const id = Number(req.params.id); const adjustment = numberValue(req.body?.adjustment);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });
  if (!Number.isInteger(adjustment) || adjustment === 0) return res.status(400).json({ error: "Adjustment must be a non-zero whole number." });
  try {
    await ensureInventorySchema();
    const existing = await db.execute(sql.raw(`SELECT quantity FROM smp_inventory_items WHERE id = ${id} LIMIT 1`));
    if (!existing.rows.length) return res.status(404).json({ error: "Inventory item not found" });
    const current = Number((existing.rows[0] as { quantity: unknown }).quantity); const next = current + adjustment;
    if (next < 0) return res.status(400).json({ error: "Quantity cannot be less than 0." });
    const result = await db.execute(sql.raw(`UPDATE smp_inventory_items SET quantity = ${next}, updated_at = NOW() WHERE id = ${id} RETURNING ${selectFields}`));
    return res.json(result.rows[0]);
  } catch (error) { req.log.error({ err: error }, "Inventory adjustment failed"); return res.status(400).json({ error: "Failed to adjust inventory quantity." }); }
});

router.delete("/admin/inventory/:id", async (req, res) => {
  const id = Number(req.params.id); if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });
  try { await ensureInventorySchema(); const result = await db.execute(sql.raw(`DELETE FROM smp_inventory_items WHERE id = ${id} RETURNING id`)); if (!result.rows.length) return res.status(404).json({ error: "Inventory item not found" }); return res.status(204).send(); }
  catch (error) { req.log.error({ err: error }, "Inventory delete failed"); return res.status(400).json({ error: "Failed to delete inventory item." }); }
});

export default router;
