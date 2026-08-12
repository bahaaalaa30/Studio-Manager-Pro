import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

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
function getResource(value: string): (typeof resources)[Resource] | null {
  return value in resources ? resources[value as Resource] : null;
}

router.get("/admin/:resource", async (req, res) => {
  const resource = getResource(req.params.resource);
  if (!resource) return res.status(404).json({ error: "Unknown admin resource" });
  try {
    const search = String(req.query.search ?? "").trim();
    const result = await db.execute(sql.raw(
      `SELECT * FROM ${resource.table}${search ? ` WHERE ${resource.columns.map((c) => `CAST(${c} AS TEXT) ILIKE '%${search.replace(/'/g, "''")}%'`).join(" OR ")}` : ""} ORDER BY id DESC LIMIT 200`
    ));
    return res.json(result.rows);
  } catch (error) {
    req.log.error({ err: error }, "Admin list failed");
    return res.status(500).json({ error: "Failed to load admin data" });
  }
});

router.post("/admin/:resource", async (req, res) => {
  const resource = getResource(req.params.resource);
  if (!resource) return res.status(404).json({ error: "Unknown admin resource" });
  const data = req.body && typeof req.body === "object" ? req.body : {};
  const fields = resource.columns.filter((c) => data[c] !== undefined);
  if (!fields.length) return res.status(400).json({ error: "No valid fields supplied" });
  try {
    const values = fields.map((f) => data[f]);
    const placeholders = values.map((_, i) => sql.placeholder(`v${i}`));
    const query = sql.raw(`INSERT INTO ${resource.table} (${fields.join(",")}) VALUES (${values.map((_, i) => `$${i + 1}`).join(",")}) RETURNING *`);
    const result = await db.execute(sql`${query}`);
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    req.log.error({ err: error }, "Admin create failed");
    return res.status(400).json({ error: "Failed to create record" });
  }
});

router.patch("/admin/:resource/:id", async (req, res) => {
  const resource = getResource(req.params.resource);
  if (!resource) return res.status(404).json({ error: "Unknown admin resource" });
  const data = req.body && typeof req.body === "object" ? req.body : {};
  const fields = resource.columns.filter((c) => data[c] !== undefined);
  if (!fields.length) return res.status(400).json({ error: "No valid fields supplied" });
  try {
    const sets = fields.map((f) => `${f} = ${typeof data[f] === "number" ? data[f] : `'${String(data[f]).replace(/'/g, "''")}'`}`).join(", ");
    const result = await db.execute(sql.raw(`UPDATE ${resource.table} SET ${sets}, updated_at = NOW() WHERE id = ${Number(req.params.id)} RETURNING *`));
    if (!result.rows.length) return res.status(404).json({ error: "Record not found" });
    return res.json(result.rows[0]);
  } catch (error) {
    req.log.error({ err: error }, "Admin update failed");
    return res.status(400).json({ error: "Failed to update record" });
  }
});

router.delete("/admin/:resource/:id", async (req, res) => {
  const resource = getResource(req.params.resource);
  if (!resource) return res.status(404).json({ error: "Unknown admin resource" });
  try {
    const result = await db.execute(sql.raw(`DELETE FROM ${resource.table} WHERE id = ${Number(req.params.id)} RETURNING id`));
    if (!result.rows.length) return res.status(404).json({ error: "Record not found" });
    return res.status(204).send();
  } catch (error) {
    req.log.error({ err: error }, "Admin delete failed");
    return res.status(400).json({ error: "Failed to delete record" });
  }
});

export default router;
