import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();
const quote = (value: unknown) => value === null || value === undefined ? "NULL" : typeof value === "number" ? String(value) : `'${String(value).replace(/'/g, "''")}'`;
const normalizeStatus = (value: unknown) => String(value ?? "").trim().toUpperCase();
const codePattern = /^[A-Za-z0-9_-]+$/;

function validatePackage(data: Record<string, unknown>) {
  const name = String(data.name ?? "").trim().replace(/\s+/g, " ");
  const code = String(data.code ?? "").trim();
  const price = Number(data.price);
  const description = data.description === null || data.description === undefined ? null : String(data.description).trim();
  const status = normalizeStatus(data.status);

  if (!name) return "Package name is required.";
  if (name.length > 120) return "Package name is too long.";
  if (!code) return "Package code is required.";
  if (!codePattern.test(code)) return "Package code may contain letters, numbers, hyphens and underscores only.";
  if (!Number.isFinite(price) || price < 0) return "Price must be a number greater than or equal to 0.";
  if (description && description.length > 500) return "Description is too long.";
  if (!["ACTIVE", "INACTIVE"].includes(status)) return "Status must be Active or Not Active.";
  return null;
}

router.patch("/admin/packages/:id", async (req, res) => {
  const packageId = Number(req.params.id);
  if (!Number.isInteger(packageId) || packageId <= 0) return res.status(400).json({ error: "Invalid package id." });

  const data = req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};
  const validation = validatePackage(data);
  if (validation) return res.status(400).json({ error: validation });

  const name = String(data.name).trim().replace(/\s+/g, " ");
  const code = String(data.code).trim();
  const price = Number(data.price);
  const description = data.description === null || data.description === undefined || String(data.description).trim() === "" ? null : String(data.description).trim();
  const status = normalizeStatus(data.status);

  try {
    const existing = await db.execute(sql.raw(`SELECT id FROM smp_packages WHERE id = ${packageId} LIMIT 1`));
    if (!existing.rows.length) return res.status(404).json({ error: "Package not found." });

    const duplicate = await db.execute(sql.raw(`SELECT id FROM smp_packages WHERE code = ${quote(code)} AND id <> ${packageId} LIMIT 1`));
    if (duplicate.rows.length) return res.status(409).json({ error: "Package code already exists." });

    const result = await db.execute(sql.raw(`UPDATE smp_packages SET name = ${quote(name)}, code = ${quote(code)}, price = ${quote(price)}, description = ${quote(description)}, status = ${quote(status)}, updated_at = NOW() WHERE id = ${packageId} RETURNING *`));
    return res.json(result.rows[0]);
  } catch (error) {
    req.log.error({ err: error, packageId }, "Package update failed");
    return res.status(400).json({ error: "Failed to update package." });
  }
});

router.delete("/admin/packages/:id", async (req, res) => {
  const packageId = Number(req.params.id);
  if (!Number.isInteger(packageId) || packageId <= 0) return res.status(400).json({ error: "Invalid package id." });

  try {
    const existing = await db.execute(sql.raw(`SELECT id, name FROM smp_packages WHERE id = ${packageId} LIMIT 1`));
    if (!existing.rows.length) return res.status(404).json({ error: "Package not found." });

    await db.execute(sql.raw(`DELETE FROM smp_packages WHERE id = ${packageId}`));
    return res.json({ success: true, id: packageId });
  } catch (error) {
    req.log.error({ err: error, packageId }, "Package delete failed");
    return res.status(400).json({ error: "Failed to delete package." });
  }
});

export default router;
