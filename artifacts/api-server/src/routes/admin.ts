import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { randomBytes, scryptSync } from "node:crypto";

const router = Router();
const resources = {
  users: { table: "smp_users", columns: ["name", "username", "role_id", "branch_id", "status", "address", "phone"] },
  branches: { table: "smp_branches", columns: ["name", "code", "address", "phone", "manager_user_id", "status"] },
  roles: { table: "smp_roles", columns: ["name", "description", "status"] },
  permissions: { table: "smp_permissions", columns: ["key", "name", "module", "action", "description"] },
  services: { table: "smp_services", columns: ["name", "code", "price", "is_free", "urgent_allowed", "urgent_price", "normal_delivery_days", "urgent_delivery_days", "description", "status"] },
  packages: { table: "smp_packages", columns: ["name", "code", "price", "description", "status"] },
  inventory: { table: "smp_inventory_items", columns: ["name", "sku", "category", "unit", "quantity", "minimum_quantity", "status"] },
} as const;
type Resource = keyof typeof resources;
const getResource = (value: string) => (value in resources ? resources[value as Resource] : null);
const quote = (value: unknown) => value === null || value === undefined ? "NULL" : typeof value === "number" ? String(value) : typeof value === "boolean" ? (value ? "TRUE" : "FALSE") : `'${String(value).replace(/'/g, "''")}'`;
const hashPassword = (password: string) => { const salt = randomBytes(16).toString("hex"); return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`; };
const normalizeStatus = (value: unknown) => String(value ?? "").trim().toUpperCase();
const namePattern = /^[A-Za-z0-9\u0600-\u06FF]+(?: [A-Za-z0-9\u0600-\u06FF]+)*$/;
const usernamePattern = /^[A-Za-z0-9]+$/;
const codePattern = /^[A-Za-z0-9_-]+$/;
const addressPattern = /^[A-Za-z0-9\u0600-\u06FF]+(?:[ ,./#-][A-Za-z0-9\u0600-\u06FF]+)*$/;
const phonePattern = /^\d{7,15}$/;
const serviceNamePattern = /^\S(?:.*\S)?$/u;
const serviceDescriptionPattern = /^[A-Za-z0-9\u0600-\u06FF]+(?:[ A-Za-z0-9\u0600-\u06FF.,!?()/#&+_-]+)*$/;

function validateUser(data: Record<string, unknown>, isCreate: boolean) {
  const name = String(data.name ?? "").trim().replace(/\s+/g, " ");
  const username = String(data.username ?? "").trim();
  const password = typeof data.password === "string" ? data.password : "";
  const roleId = Number(data.role_id); const branchId = Number(data.branch_id); const status = normalizeStatus(data.status);
  const address = String(data.address ?? "").trim(); const phone = String(data.phone ?? "").trim();
  if (!name || !namePattern.test(name)) return "Name is required and must contain letters/numbers.";
  if (!username || username.length < 4 || !usernamePattern.test(username)) return "Username is required, must be at least 4 characters, and may contain letters and numbers only.";
  if (isCreate && (!password || password.length < 4)) return "Password is required and must be at least 4 characters.";
  if (!isCreate && password && password.length < 4) return "Password must be at least 4 characters.";
  if (!Number.isInteger(roleId) || roleId <= 0) return "A valid Role is required.";
  if (!Number.isInteger(branchId) || branchId <= 0) return "A valid Branch is required.";
  if (!["ACTIVE", "INACTIVE"].includes(status)) return "Status must be Active or Not Active.";
  if (address && !addressPattern.test(address)) return "Address may contain letters, numbers, spaces and common address separators only.";
  if (phone && !phonePattern.test(phone)) return "Phone must contain numbers only and be 7 to 15 digits.";
  return null;
}

function validateBranch(data: Record<string, unknown>) {
  const name = String(data.name ?? "").trim().replace(/\s+/g, " "); const code = String(data.code ?? "").trim();
  const address = String(data.address ?? "").trim(); const phone = String(data.phone ?? "").trim();
  const managerUserId = data.manager_user_id === "" || data.manager_user_id === null || data.manager_user_id === undefined ? null : Number(data.manager_user_id);
  const status = normalizeStatus(data.status);
  if (!name) return "Branch name is required.";
  if (!code) return "Branch code is required.";
  if (!codePattern.test(code)) return "Branch code may contain letters, numbers, hyphens and underscores only.";
  if (!["ACTIVE", "INACTIVE"].includes(status)) return "Status must be Active or Not Active.";
  if (address && !addressPattern.test(address)) return "Address may contain letters, numbers, spaces and common address separators only.";
  if (phone && !phonePattern.test(phone)) return "Phone must contain numbers only and be 7 to 15 digits.";
  if (managerUserId !== null && (!Number.isInteger(managerUserId) || managerUserId <= 0)) return "Manager must be a valid user.";
  return null;
}

function validateService(data: Record<string, unknown>) {
  const name = String(data.name ?? "").trim().replace(/\s+/g, " ");
  const code = String(data.code ?? "").trim();
  const description = String(data.description ?? "").trim();
  const isFree = data.is_free === true || String(data.is_free ?? "").toLowerCase() === "true";
  const urgentAllowed = data.urgent_allowed === true || String(data.urgent_allowed ?? "").toLowerCase() === "true";
  const price = Number(data.price);
  const urgentPrice = data.urgent_price === null || data.urgent_price === undefined || data.urgent_price === "" ? null : Number(data.urgent_price);
  const normalDays = Number(data.normal_delivery_days);
  const urgentDays = data.urgent_delivery_days === null || data.urgent_delivery_days === undefined || data.urgent_delivery_days === "" ? null : Number(data.urgent_delivery_days);
  const status = normalizeStatus(data.status);
  if (!name) return "Service name is required.";
  if (name.length > 120 || !serviceNamePattern.test(name)) return "Service name is required and may contain any letters, numbers, spaces, or special characters, but cannot start or end with whitespace.";
  if (!code) return "Code is required.";
  if (!codePattern.test(code)) return "Code may contain letters, numbers, hyphens and underscores only.";
  if (!Number.isFinite(price) || price < 0) return "Price must be a number greater than or equal to 0.";
  if (isFree && price !== 0) return "Free services must have a price of 0.";
  if (!isFree && price < 0) return "Price cannot be negative.";
  if (description && (description.length > 500 || !serviceDescriptionPattern.test(description))) return "Description contains unsupported characters or is too long.";
  if (!["ACTIVE", "INACTIVE"].includes(status)) return "Status must be Active or Not Active.";
  if (!Number.isInteger(normalDays) || normalDays < 0) return "Normal delivery days must be a whole number greater than or equal to 0.";
  if (!urgentAllowed) {
    if (urgentPrice !== null || urgentDays !== null) return "Urgent price and urgent delivery days must be empty when Urgent is not allowed.";
  } else {
    if (urgentPrice === null || !Number.isFinite(urgentPrice) || urgentPrice < 0) return "Urgent price is required and must be greater than or equal to 0.";
    if (urgentDays === null || !Number.isInteger(urgentDays) || urgentDays < 0) return "Urgent delivery days is required and must be a whole number greater than or equal to 0.";
    if (urgentDays > normalDays) return "Urgent delivery cannot be longer than normal delivery.";
  }
  return null;
}

router.get("/admin/:resource", async (req, res) => {
  const resource = getResource(req.params.resource); if (!resource) return res.status(404).json({ error: "Unknown admin resource" });
  try {
    const search = String(req.query.search ?? "").trim().replace(/'/g, "''");
    if (req.params.resource === "users") {
      const where = search ? `WHERE u.name ILIKE '%${search}%' OR u.username ILIKE '%${search}%' OR r.name ILIKE '%${search}%' OR b.name ILIKE '%${search}%'` : "";
      const result = await db.execute(sql.raw(`SELECT u.id, u.name, u.username, u.role_id, r.name AS role_name, u.branch_id, b.name AS branch_name, u.status, u.address, u.phone, u.must_change_password, u.password_set_at, u.last_login_at FROM smp_users u LEFT JOIN smp_roles r ON r.id = u.role_id LEFT JOIN smp_branches b ON b.id = u.branch_id ${where} ORDER BY u.id DESC LIMIT 200`)); return res.json(result.rows);
    }
    if (req.params.resource === "branches") {
      const where = search ? `WHERE b.name ILIKE '%${search}%' OR b.code ILIKE '%${search}%' OR b.address ILIKE '%${search}%' OR b.phone ILIKE '%${search}%' OR u.name ILIKE '%${search}%'` : "";
      const result = await db.execute(sql.raw(`SELECT b.id, b.name, b.code, b.address, b.phone, b.manager_user_id, u.name AS manager_name, b.status, b.created_at, b.updated_at FROM smp_branches b LEFT JOIN smp_users u ON u.id = b.manager_user_id ${where} ORDER BY b.id DESC LIMIT 200`)); return res.json(result.rows);
    }
    const where = search ? ` WHERE ${resource.columns.map((c) => `CAST(${c} AS TEXT) ILIKE '%${search}%'`).join(" OR ")}` : "";
    const result = await db.execute(sql.raw(`SELECT * FROM ${resource.table}${where} ORDER BY id DESC LIMIT 200`)); return res.json(result.rows);
  } catch (error) { req.log.error({ err: error }, "Admin list failed"); return res.status(500).json({ error: "Failed to load admin data" }); }
});

router.get("/admin/options/users", async (req, res) => {
  try { const result = await db.execute(sql.raw(`SELECT id, name, username, status FROM smp_users WHERE UPPER(status) = 'ACTIVE' ORDER BY name ASC LIMIT 500`)); return res.json(result.rows); }
  catch (error) { req.log.error({ err: error }, "User options load failed"); return res.status(500).json({ error: "Failed to load users" }); }
});

router.post("/admin/:resource", async (req, res) => {
  const resource = getResource(req.params.resource); if (!resource) return res.status(404).json({ error: "Unknown admin resource" });
  const data = req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};
  if (req.params.resource === "users") {
    const validation = validateUser(data, true); if (validation) return res.status(400).json({ error: validation });
    const { name, username, password, role_id, branch_id, status, address, phone } = data;
    try {
      const roleCheck = await db.execute(sql.raw(`SELECT id FROM smp_roles WHERE id = ${Number(role_id)} AND UPPER(status) = 'ACTIVE' LIMIT 1`));
      const branchCheck = await db.execute(sql.raw(`SELECT id FROM smp_branches WHERE id = ${Number(branch_id)} AND UPPER(status) = 'ACTIVE' LIMIT 1`));
      if (!roleCheck.rows.length) return res.status(400).json({ error: "Selected Role is not available." }); if (!branchCheck.rows.length) return res.status(400).json({ error: "Selected Branch is not available." });
      const result = await db.execute(sql.raw(`INSERT INTO smp_users (name, username, password_hash, password_set_at, must_change_password, role_id, branch_id, status, address, phone) VALUES (${quote(String(name).trim().replace(/\s+/g, " "))}, ${quote(String(username).trim())}, ${quote(hashPassword(String(password)))}, NOW(), FALSE, ${Number(role_id)}, ${Number(branch_id)}, ${quote(normalizeStatus(status))}, ${quote(address ? String(address).trim() : null)}, ${quote(phone ? String(phone).trim() : null)}) RETURNING id, name, username, role_id, branch_id, status, address, phone, must_change_password, password_set_at, last_login_at`)); return res.status(201).json(result.rows[0]);
    } catch (error) { req.log.error({ err: error }, "User create failed"); return res.status(400).json({ error: "Failed to create user. Username may already exist or the selected role/branch is invalid." }); }
  }
  if (req.params.resource === "branches") {
    const validation = validateBranch(data); if (validation) return res.status(400).json({ error: validation });
    const name = String(data.name).trim().replace(/\s+/g, " "); const code = String(data.code).trim(); const address = data.address ? String(data.address).trim() : null; const phone = data.phone ? String(data.phone).trim() : null; const managerUserId = data.manager_user_id === "" || data.manager_user_id === null || data.manager_user_id === undefined ? null : Number(data.manager_user_id); const status = normalizeStatus(data.status);
    try { if (managerUserId !== null) { const manager = await db.execute(sql.raw(`SELECT id FROM smp_users WHERE id = ${managerUserId} AND UPPER(status) = 'ACTIVE' LIMIT 1`)); if (!manager.rows.length) return res.status(400).json({ error: "Selected manager is not an active user." }); } const result = await db.execute(sql.raw(`INSERT INTO smp_branches (name, code, address, phone, manager_user_id, status) VALUES (${quote(name)}, ${quote(code)}, ${quote(address)}, ${quote(phone)}, ${managerUserId === null ? "NULL" : String(managerUserId)}, ${quote(status)}) RETURNING *`)); return res.status(201).json(result.rows[0]); }
    catch (error) { req.log.error({ err: error }, "Branch create failed"); return res.status(400).json({ error: "Failed to create branch. Branch code may already exist or the selected manager is invalid." }); }
  }
  if (req.params.resource === "services") {
    const validation = validateService(data); if (validation) return res.status(400).json({ error: validation });
    const normalized = { ...data, name: String(data.name).trim().replace(/\s+/g, " "), code: String(data.code).trim(), price: Number(data.is_free === true || String(data.is_free).toLowerCase() === "true" ? 0 : data.price), is_free: data.is_free === true || String(data.is_free ?? "").toLowerCase() === "true", urgent_allowed: data.urgent_allowed === true || String(data.urgent_allowed ?? "").toLowerCase() === "true", urgent_price: data.urgent_allowed === true || String(data.urgent_allowed ?? "").toLowerCase() === "true" ? Number(data.urgent_price) : null, normal_delivery_days: Number(data.normal_delivery_days), urgent_delivery_days: data.urgent_allowed === true || String(data.urgent_allowed ?? "").toLowerCase() === "true" ? Number(data.urgent_delivery_days) : null, description: data.description ? String(data.description).trim() : null, status: normalizeStatus(data.status) };
    const fields = resource.columns.filter((c) => normalized[c] !== undefined && normalized[c] !== "");
    try { const values = fields.map((field) => quote(normalized[field])); const result = await db.execute(sql.raw(`INSERT INTO ${resource.table} (${fields.join(",")}) VALUES (${values.join(",")}) RETURNING *`)); return res.status(201).json(result.rows[0]); }
    catch (error) { req.log.error({ err: error }, "Service create failed"); return res.status(400).json({ error: "Failed to create service. Code may already exist." }); }
  }
  const fields = resource.columns.filter((c) => data[c] !== undefined && data[c] !== ""); if (!fields.length) return res.status(400).json({ error: "No valid fields supplied" });
  try { const values = fields.map((field) => quote(data[field])); const result = await db.execute(sql.raw(`INSERT INTO ${resource.table} (${fields.join(",")}) VALUES (${values.join(",")}) RETURNING *`)); return res.status(201).json(result.rows[0]); }
  catch (error) { req.log.error({ err: error }, "Admin create failed"); return res.status(400).json({ error: "Failed to create record" }); }
});

router.patch("/admin/:resource/:id", async (req, res) => {
  const resource = getResource(req.params.resource); if (!resource) return res.status(404).json({ error: "Unknown admin resource" });
  const data = req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {}; const id = Number(req.params.id); if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });
  if (req.params.resource === "users") {
    const existing = await db.execute(sql.raw(`SELECT id, name, username, role_id, branch_id, status, address, phone FROM smp_users WHERE id = ${id} LIMIT 1`)); if (!existing.rows.length) return res.status(404).json({ error: "Record not found" });
    const merged = { ...(existing.rows[0] as Record<string, unknown>), ...data }; const validation = validateUser(merged, false); if (validation) return res.status(400).json({ error: validation });
    try { const roleId = Number(merged.role_id); const branchId = Number(merged.branch_id); const roleCheck = await db.execute(sql.raw(`SELECT id FROM smp_roles WHERE id = ${roleId} AND UPPER(status) = 'ACTIVE' LIMIT 1`)); const branchCheck = await db.execute(sql.raw(`SELECT id FROM smp_branches WHERE id = ${branchId} AND UPPER(status) = 'ACTIVE' LIMIT 1`)); if (!roleCheck.rows.length) return res.status(400).json({ error: "Selected Role is not available." }); if (!branchCheck.rows.length) return res.status(400).json({ error: "Selected Branch is not available." }); const sets = ["name", "username", "role_id", "branch_id", "status", "address", "phone"].filter((field) => data[field] !== undefined).map((field) => `${field} = ${quote(data[field] === "" ? null : field === "status" ? normalizeStatus(data[field]) : field === "name" ? String(data[field]).trim().replace(/\s+/g, " ") : data[field])}`); if (typeof data.password === "string" && data.password.length) sets.push(`password_hash = ${quote(hashPassword(data.password))}`, "password_set_at = NOW()"); if (!sets.length) return res.status(400).json({ error: "No changes supplied" }); sets.push("updated_at = NOW()"); const result = await db.execute(sql.raw(`UPDATE smp_users SET ${sets.join(", ")} WHERE id = ${id} RETURNING id, name, username, role_id, branch_id, status, address, phone, must_change_password, password_set_at, last_login_at`)); return res.json(result.rows[0]); }
    catch (error) { req.log.error({ err: error }, "User update failed"); return res.status(400).json({ error: "Failed to update user. Username may already exist or the selected role/branch is invalid." }); }
  }
  if (req.params.resource === "branches") {
    const existing = await db.execute(sql.raw(`SELECT id, name, code, address, phone, manager_user_id, status FROM smp_branches WHERE id = ${id} LIMIT 1`)); if (!existing.rows.length) return res.status(404).json({ error: "Record not found" }); const merged = { ...(existing.rows[0] as Record<string, unknown>), ...data }; const validation = validateBranch(merged); if (validation) return res.status(400).json({ error: validation }); const managerUserId = merged.manager_user_id === "" || merged.manager_user_id === null || merged.manager_user_id === undefined ? null : Number(merged.manager_user_id);
    try { if (managerUserId !== null) { const manager = await db.execute(sql.raw(`SELECT id FROM smp_users WHERE id = ${managerUserId} AND UPPER(status) = 'ACTIVE' LIMIT 1`)); if (!manager.rows.length) return res.status(400).json({ error: "Selected manager is not an active user." }); } const fields = ["name", "code", "address", "phone", "manager_user_id", "status"].filter((field) => data[field] !== undefined); if (!fields.length) return res.status(400).json({ error: "No changes supplied" }); const sets = fields.map((field) => { const value = field === "manager_user_id" ? managerUserId : field === "status" ? normalizeStatus(data[field]) : field === "name" || field === "code" || field === "address" || field === "phone" ? (data[field] === "" ? null : String(data[field]).trim()) : data[field]; return `${field} = ${quote(value)}`; }); sets.push("updated_at = NOW()"); const result = await db.execute(sql.raw(`UPDATE smp_branches SET ${sets.join(", ")} WHERE id = ${id} RETURNING *`)); return res.json(result.rows[0]); }
    catch (error) { req.log.error({ err: error }, "Branch update failed"); return res.status(400).json({ error: "Failed to update branch. Branch code may already exist or the selected manager is invalid." }); }
  }
  if (req.params.resource === "services") {
    const existing = await db.execute(sql.raw(`SELECT * FROM smp_services WHERE id = ${id} LIMIT 1`)); if (!existing.rows.length) return res.status(404).json({ error: "Record not found" }); const merged = { ...(existing.rows[0] as Record<string, unknown>), ...data }; const validation = validateService(merged); if (validation) return res.status(400).json({ error: validation });
    const isFree = merged.is_free === true || String(merged.is_free ?? "").toLowerCase() === "true"; const urgentAllowed = merged.urgent_allowed === true || String(merged.urgent_allowed ?? "").toLowerCase() === "true"; const normalized: Record<string, unknown> = { ...data, name: String(merged.name).trim().replace(/\s+/g, " "), code: String(merged.code).trim(), price: isFree ? 0 : Number(merged.price), is_free: isFree, urgent_allowed: urgentAllowed, urgent_price: urgentAllowed ? Number(merged.urgent_price) : null, normal_delivery_days: Number(merged.normal_delivery_days), urgent_delivery_days: urgentAllowed ? Number(merged.urgent_delivery_days) : null, description: merged.description ? String(merged.description).trim() : null, status: normalizeStatus(merged.status) };
    const fields = resource.columns.filter((c) => data[c] !== undefined || ["is_free", "urgent_allowed", "urgent_price", "normal_delivery_days", "urgent_delivery_days"].includes(c));
    try { const sets = fields.map((field) => `${field} = ${quote(normalized[field])}`); if (!sets.length) return res.status(400).json({ error: "No changes supplied" }); sets.push("updated_at = NOW()"); const result = await db.execute(sql.raw(`UPDATE smp_services SET ${sets.join(", ")} WHERE id = ${id} RETURNING *`)); return res.json(result.rows[0]); }
    catch (error) { req.log.error({ err: error }, "Service update failed"); return res.status(400).json({ error: "Failed to update service. Code may already exist." }); }
  }
  const fields = resource.columns.filter((c) => data[c] !== undefined); if (!fields.length) return res.status(400).json({ error: "No valid fields supplied" });
  try { const sets = fields.map((field) => `${field} = ${quote(data[field])}`).join(", "); const result = await db.execute(sql.raw(`UPDATE ${resource.table} SET ${sets}, updated_at = NOW() WHERE id = ${id} RETURNING *`)); if (!result.rows.length) return res.status(404).json({ error: "Record not found" }); return res.json(result.rows[0]); }
  catch (error) { req.log.error({ err: error }, "Admin update failed"); return res.status(400).json({ error: "Failed to update record" }); }
});

router.get("/admin/roles/:id/permissions", async (req, res) => { const roleId = Number(req.params.id); if (!Number.isInteger(roleId)) return res.status(400).json({ error: "Invalid role id" }); try { const result = await db.execute(sql.raw(`SELECT p.id, p.key, p.name, p.module, p.action, p.description, (rp.role_id IS NOT NULL) AS granted FROM smp_permissions p LEFT JOIN smp_role_permissions rp ON rp.permission_id = p.id AND rp.role_id = ${roleId} ORDER BY p.module, p.action, p.key`)); return res.json(result.rows); } catch (error) { req.log.error({ err: error }, "Role permissions load failed"); return res.status(500).json({ error: "Failed to load role permissions" }); } });
router.put("/admin/roles/:id/permissions", async (req, res) => { const roleId = Number(req.params.id); const permissionIds = Array.isArray(req.body?.permission_ids) ? req.body.permission_ids.map(Number).filter(Number.isInteger) : []; if (!Number.isInteger(roleId)) return res.status(400).json({ error: "Invalid role id" }); try { await db.execute(sql.raw(`DELETE FROM smp_role_permissions WHERE role_id = ${roleId}`)); if (permissionIds.length) await db.execute(sql.raw(`INSERT INTO smp_role_permissions (role_id, permission_id) VALUES ${permissionIds.map((permissionId: number) => `(${roleId}, ${permissionId})`).join(",")} ON CONFLICT DO NOTHING`)); return res.json({ role_id: roleId, permission_ids: permissionIds }); } catch (error) { req.log.error({ err: error }, "Failed to update role permissions" ); return res.status(400).json({ error: "Failed to update role permissions" }); } });
router.get("/admin/users/:id/permissions", async (req, res) => { const userId = Number(req.params.id); if (!Number.isInteger(userId)) return res.status(400).json({ error: "Invalid user id" }); try { const result = await db.execute(sql.raw(`SELECT p.id, p.key, p.name, p.module, p.action, p.description, up.granted AS override_granted FROM smp_permissions p LEFT JOIN smp_user_permissions up ON up.permission_id = p.id AND up.user_id = ${userId} ORDER BY p.module, p.action, p.key`)); return res.json(result.rows); } catch (error) { req.log.error({ err: error }, "User permissions load failed"); return res.status(500).json({ error: "Failed to load user permissions" }); } });
router.put("/admin/users/:id/permissions", async (req, res) => { const userId = Number(req.params.id); const overrides = Array.isArray(req.body?.permissions) ? req.body.permissions : []; if (!Number.isInteger(userId)) return res.status(400).json({ error: "Invalid user id" }); try { await db.execute(sql.raw(`DELETE FROM smp_user_permissions WHERE user_id = ${userId}`)); for (const item of overrides) { const permissionId = Number(item?.permission_id); if (!Number.isInteger(permissionId) || typeof item?.granted !== "boolean") continue; await db.execute(sql.raw(`INSERT INTO smp_user_permissions (user_id, permission_id, granted) VALUES (${userId}, ${permissionId}, ${item.granted ? "TRUE" : "FALSE"}) ON CONFLICT (user_id, permission_id) DO UPDATE SET granted = EXCLUDED.granted`)); } return res.json({ user_id: userId, permissions: overrides }); } catch (error) { req.log.error({ err: error }, "Failed to update user permissions" ); return res.status(400).json({ error: "Failed to update user permissions" }); } });
router.delete("/admin/:resource/:id", async (req, res) => { const resource = getResource(req.params.resource); if (!resource) return res.status(404).json({ error: "Unknown admin resource" }); const id = Number(req.params.id); if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" }); try { const result = await db.execute(sql.raw(`DELETE FROM ${resource.table} WHERE id = ${id} RETURNING id`)); if (!result.rows.length) return res.status(404).json({ error: "Record not found" }); return res.status(204).send(); } catch (error) { req.log.error({ err: error }, "Failed to delete admin record"); return res.status(400).json({ error: "Failed to delete record" }); } });
export default router;
