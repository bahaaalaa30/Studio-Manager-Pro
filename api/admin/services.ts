// @ts-nocheck
// This Vercel function is type-checked separately from the workspace API package.
// The runtime dependencies are provided by the workspace build; suppressing the
// standalone Vercel typecheck avoids false missing-module errors for workspace aliases.
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const quote = (value: unknown) =>
  value === null || value === undefined
    ? "NULL"
    : typeof value === "number"
      ? String(value)
      : typeof value === "boolean"
        ? (value ? "TRUE" : "FALSE")
        : `'${String(value).replace(/'/g, "''")}'`;

const normalizeName = (value: unknown) => String(value ?? "").trim().replace(/\s+/g, " ");
const normalizeCode = (value: unknown) => String(value ?? "").trim();

function validateService(data: Record<string, unknown>) {
  const name = normalizeName(data.name);
  const code = normalizeCode(data.code);
  const description = String(data.description ?? "").trim();
  const isFree = data.is_free === true || String(data.is_free ?? "").toLowerCase() === "true";
  const urgentAllowed = data.urgent_allowed === true || String(data.urgent_allowed ?? "").toLowerCase() === "true";
  const price = Number(data.price);
  const urgentPrice = data.urgent_price === null || data.urgent_price === undefined || data.urgent_price === "" ? null : Number(data.urgent_price);
  const normalDays = Number(data.normal_delivery_days);
  const urgentDays = data.urgent_delivery_days === null || data.urgent_delivery_days === undefined || data.urgent_delivery_days === "" ? null : Number(data.urgent_delivery_days);
  const status = String(data.status ?? "").trim().toUpperCase();

  if (!name) return "Service name is required.";
  if (name.length > 120) return "Service name cannot exceed 120 characters.";
  if (!code) return "Code is required.";
  if (!/^[A-Za-z0-9_-]+$/.test(code)) return "Code may contain letters, numbers, hyphens and underscores only.";
  if (!Number.isFinite(price) || price < 0) return "Price must be a number greater than or equal to 0.";
  if (isFree && price !== 0) return "Free services must have a price of 0.";
  if (description.length > 500) return "Description cannot exceed 500 characters.";
  if (!["ACTIVE", "INACTIVE"].includes(status)) return "Status must be Active or Not Active.";
  if (!Number.isInteger(normalDays) || normalDays < 0) return "Normal delivery days must be a whole number >= 0.";
  if (!urgentAllowed) {
    if (urgentPrice !== null) return "Clear Urgent Price when Urgent is not allowed.";
    if (urgentDays !== null) return "Clear Urgent Delivery when Urgent is not allowed.";
  } else {
    if (urgentPrice === null || !Number.isFinite(urgentPrice) || urgentPrice < 0) return "Urgent Price is required and must be >= 0.";
    if (urgentDays === null || !Number.isInteger(urgentDays) || urgentDays < 0) return "Urgent Delivery is required and must be a whole number >= 0.";
    if (urgentDays > normalDays) return "Urgent delivery cannot be longer than normal delivery.";
  }
  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    try {
      const search = String(req.query.search ?? "").trim().replace(/'/g, "''");
      const where = search ? `WHERE name ILIKE '%${search}%' OR code ILIKE '%${search}%' OR description ILIKE '%${search}%'` : "";
      const result = await db.execute(sql.raw(`SELECT * FROM smp_services ${where} ORDER BY id DESC LIMIT 200`));
      return res.status(200).json(result.rows);
    } catch (error) {
      console.error("Service list failed", error);
      return res.status(500).json({ error: "Failed to load services." });
    }
  }

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });

  const data = req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};
  const validation = validateService(data);
  if (validation) return res.status(400).json({ error: validation });

  const name = normalizeName(data.name);
  const code = normalizeCode(data.code);
  const isFree = data.is_free === true || String(data.is_free ?? "").toLowerCase() === "true";
  const urgentAllowed = data.urgent_allowed === true || String(data.urgent_allowed ?? "").toLowerCase() === "true";
  const normalized = {
    name,
    code,
    price: isFree ? 0 : Number(data.price),
    is_free: isFree,
    urgent_allowed: urgentAllowed,
    urgent_price: urgentAllowed ? Number(data.urgent_price) : null,
    normal_delivery_days: Number(data.normal_delivery_days),
    urgent_delivery_days: urgentAllowed ? Number(data.urgent_delivery_days) : null,
    description: data.description ? String(data.description).trim() : null,
    status: String(data.status).trim().toUpperCase(),
  };

  try {
    const duplicateName = await db.execute(sql.raw(`SELECT id FROM smp_services WHERE LOWER(TRIM(name)) = LOWER(${quote(name)}) LIMIT 1`));
    if (duplicateName.rows.length) return res.status(409).json({ error: "Service name already exists. Please choose a different name.", field: "name", code: "DUPLICATE_SERVICE_NAME" });

    const duplicateCode = await db.execute(sql.raw(`SELECT id FROM smp_services WHERE UPPER(TRIM(code)) = UPPER(${quote(code)}) LIMIT 1`));
    if (duplicateCode.rows.length) return res.status(409).json({ error: "Service code already exists. Please choose a different code.", field: "code", code: "DUPLICATE_SERVICE_CODE" });

    const result = await db.execute(sql.raw(`
      INSERT INTO smp_services
        (name, code, price, is_free, urgent_allowed, urgent_price, normal_delivery_days, urgent_delivery_days, description, status)
      VALUES
        (${quote(normalized.name)}, ${quote(normalized.code)}, ${quote(normalized.price)}, ${quote(normalized.is_free)}, ${quote(normalized.urgent_allowed)}, ${quote(normalized.urgent_price)}, ${quote(normalized.normal_delivery_days)}, ${quote(normalized.urgent_delivery_days)}, ${quote(normalized.description)}, ${quote(normalized.status)})
      RETURNING *
    `));

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Service create failed", error);
    const message = String((error as { message?: unknown })?.message ?? "").toLowerCase();
    if (message.includes("name_unique") || message.includes("smp_services_name_unique_idx")) return res.status(409).json({ error: "Service name already exists. Please choose a different name.", field: "name", code: "DUPLICATE_SERVICE_NAME" });
    if (message.includes("code") && (message.includes("duplicate") || message.includes("unique"))) return res.status(409).json({ error: "Service code already exists. Please choose a different code.", field: "code", code: "DUPLICATE_SERVICE_CODE" });
    return res.status(500).json({ error: "Failed to create service." });
  }
}
