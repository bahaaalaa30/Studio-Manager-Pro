import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

const quote = (value: unknown) =>
  value === null || value === undefined
    ? "NULL"
    : typeof value === "number"
      ? String(value)
      : typeof value === "boolean"
        ? value ? "TRUE" : "FALSE"
        : `'${String(value).replace(/'/g, "''")}'`;

router.post("/admin/services", async (req, res) => {
  const data = req.body && typeof req.body === "object"
    ? req.body as Record<string, unknown>
    : {};

  const name = String(data.name ?? "").trim().replace(/\s+/g, " ");
  const code = String(data.code ?? "").trim();
  const isFree = data.is_free === true || String(data.is_free ?? "").toLowerCase() === "true";
  const urgentAllowed = data.urgent_allowed === true || String(data.urgent_allowed ?? "").toLowerCase() === "true";
  const price = isFree ? 0 : Number(data.price);
  const urgentPrice = urgentAllowed && data.urgent_price !== null && data.urgent_price !== undefined && data.urgent_price !== ""
    ? Number(data.urgent_price)
    : null;
  const normalDeliveryDays = Number(data.normal_delivery_days);
  const urgentDeliveryDays = urgentAllowed && data.urgent_delivery_days !== null && data.urgent_delivery_days !== undefined && data.urgent_delivery_days !== ""
    ? Number(data.urgent_delivery_days)
    : null;
  const description = data.description ? String(data.description).trim() : null;
  const status = String(data.status ?? "").trim().toUpperCase();

  if (!name) return res.status(400).json({ error: "Service name is required." });
  if (!code) return res.status(400).json({ error: "Code is required." });
  if (!Number.isFinite(price) || price < 0) return res.status(400).json({ error: "Price must be a number greater than or equal to 0." });
  if (isFree && price !== 0) return res.status(400).json({ error: "Free services must have a price of 0." });
  if (!["ACTIVE", "INACTIVE"].includes(status)) return res.status(400).json({ error: "Status must be Active or Not Active." });
  if (!Number.isInteger(normalDeliveryDays) || normalDeliveryDays < 0) return res.status(400).json({ error: "Normal delivery days must be a whole number greater than or equal to 0." });

  if (urgentAllowed) {
    if (urgentPrice === null || !Number.isFinite(urgentPrice) || urgentPrice < 0) {
      return res.status(400).json({ error: "Urgent price is required and must be greater than or equal to 0." });
    }
    if (urgentDeliveryDays === null || !Number.isInteger(urgentDeliveryDays) || urgentDeliveryDays < 0) {
      return res.status(400).json({ error: "Urgent delivery days is required and must be a whole number greater than or equal to 0." });
    }
    if (urgentDeliveryDays > normalDeliveryDays) {
      return res.status(400).json({ error: "Urgent delivery cannot be longer than normal delivery." });
    }
  } else if (data.urgent_price !== null && data.urgent_price !== undefined && data.urgent_price !== "") {
    return res.status(400).json({ error: "Urgent price must be empty when Urgent is not allowed." });
  }

  try {
    // Service names are intentionally NOT unique. Only the service code is unique.
    const existing = await db.execute(
      sql.raw(`SELECT id FROM smp_services WHERE code = ${quote(code)} LIMIT 1`)
    );

    if (existing.rows.length) {
      return res.status(409).json({ error: "Code already exists." });
    }

    const result = await db.execute(sql.raw(`
      INSERT INTO smp_services
        (name, code, price, is_free, urgent_allowed, urgent_price,
         normal_delivery_days, urgent_delivery_days, description, status)
      VALUES
        (${quote(name)}, ${quote(code)}, ${quote(price)}, ${quote(isFree)},
         ${quote(urgentAllowed)}, ${quote(urgentPrice)}, ${quote(normalDeliveryDays)},
         ${quote(urgentDeliveryDays)}, ${quote(description)}, ${quote(status)})
      RETURNING *
    `));

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    req.log.error(
      { err: error, serviceCode: code, serviceName: name },
      "Service create failed"
    );

    const details = error instanceof Error ? error.message : String(error);
    return res.status(500).json({
      error: "Failed to create service.",
      details,
    });
  }
});

export default router;
