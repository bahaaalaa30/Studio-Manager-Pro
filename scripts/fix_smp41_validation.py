from pathlib import Path

path = Path("artifacts/studio-management/src/pages/AdminManagement.tsx")
s = path.read_text(encoding="utf-8")

old = '''function validateBranch(form: Record<string, string>): Record<string, string> { const errors: Record<string, string> = {}; const name = form.name?.trim() ?? ""; const code = form.code?.trim() ?? ""; const address = form.address?.trim() ?? ""; const phone = form.phone?.trim() ?? ""; if (!name) errors.name = "Branch name is required."; if (!code) errors.code = "Branch code is required."; else if (!/^[A-Za-z0-9_-]+$/.test(code)) errors.code = "Use letters, numbers, hyphens or underscores only."; if (!form.status) errors.status = "Status is required."; if (address && !/^[A-Za-z0-9\\u0600-\\u06FF]+(?:[ ,./#-][A-Za-z0-9\\u0600-\\u06FF]+)*$/.test(address)) errors.address = "Use letters, numbers, spaces and common address separators only."; if (phone && !/^\\d{7,15}$/.test(phone)) errors.phone = "Use numbers only, 7 to 15 digits."; return errors; }'''

new = '''function validateBranch(form: Record<string, string>): Record<string, string> { const errors: Record<string, string> = {}; const name = form.name?.trim() ?? ""; const code = form.code?.trim() ?? ""; const address = form.address?.trim() ?? ""; const phone = form.phone?.trim() ?? ""; if (!name) errors.name = "Branch name is required."; if (!code) errors.code = "Branch code is required."; else if (!/^[A-Za-z0-9_-]+$/.test(code)) errors.code = "Use letters, numbers, hyphens or underscores only."; if (!form.status) errors.status = "Status is required."; if (address && !/^[A-Za-z0-9\\u0600-\\u06FF]+(?:[ ,./#-][A-Za-z0-9\\u0600-\\u06FF]+)*$/.test(address)) errors.address = "Use letters, numbers, spaces and common address separators only."; if (phone && !/^\\d{7,15}$/.test(phone)) errors.phone = "Use numbers only, 7 to 15 digits."; return errors; }
function validateSettings(form: Record<string, string>, resource: Resource, isCreate: boolean): Record<string, string> { const errors: Record<string, string> = {}; const required = (field: string, message: string) => { if (!form[field]?.trim()) errors[field] = message; }; if (resource === "roles") { required("name", "Role name is required."); required("status", "Status is required."); } else if (resource === "permissions") { required("key", "Permission key is required."); required("name", "Permission name is required."); required("module", "Module is required."); required("action", "Action is required."); if (form.key && !/^[A-Za-z0-9._-]+$/.test(form.key.trim())) errors.key = "Permission key may contain letters, numbers, dots, hyphens and underscores only."; } else if (resource === "services" || resource === "packages") { required("name", `${resource === "services" ? "Service" : "Package"} name is required.`); required("code", "Code is required."); required("status", "Status is required."); if (form.code && !/^[A-Za-z0-9_-]+$/.test(form.code.trim())) errors.code = "Code may contain letters, numbers, hyphens and underscores only."; if (form.price?.trim() === "") errors.price = "Price is required."; else if (form.price && (!Number.isFinite(Number(form.price)) || Number(form.price) < 0)) errors.price = "Price must be a number greater than or equal to 0."; } else if (resource === "inventory") { required("name", "Item name is required."); required("sku", "SKU is required."); required("unit", "Unit is required."); required("status", "Status is required."); if (form.sku && !/^[A-Za-z0-9._-]+$/.test(form.sku.trim())) errors.sku = "SKU may contain letters, numbers, dots, hyphens and underscores only."; for (const field of ["quantity", "minimum_quantity"]) if (form[field]?.trim() && (!Number.isFinite(Number(form[field])) || Number(form[field]) < 0)) errors[field] = `${field === "quantity" ? "Quantity" : "Minimum quantity"} must be a number greater than or equal to 0.`; } return errors; }'''

if old not in s:
    raise SystemExit("validateBranch block not found")
s = s.replace(old, new, 1)

old = 'const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState(""); const [page, setPage] = useState(1);'
new = 'const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState(""); const [modalError, setModalError] = useState(""); const [page, setPage] = useState(1);'
if old not in s:
    raise SystemExit("state block not found")
s = s.replace(old, new, 1)

old = 'setShowPassword(false); setError(""); if (resource === "users") void loadUserOptions();'
new = 'setShowPassword(false); setError(""); setModalError(""); if (resource === "users") void loadUserOptions();'
if s.count(old) != 2:
    raise SystemExit(f"open modal reset block count mismatch: {s.count(old)}")
s = s.replace(old, new)

old = 'const userErrors = resource === "users" && editing ? validateUser(form, !editing.id) : {}; const branchErrors = resource === "branches" && editing ? validateBranch(form) : {}; const validationErrors = resource === "users" ? userErrors : resource === "branches" ? branchErrors : {}; const dirty = editing ? formSignature(form) !== formSignature(initialForm) : false; const canSave = !!editing && dirty && !saving && (resource === "users" || resource === "branches" ? Object.keys(validationErrors).length === 0 : true);'
new = 'const userErrors = resource === "users" && editing ? validateUser(form, !editing.id) : {}; const branchErrors = resource === "branches" && editing ? validateBranch(form) : {}; const validationErrors = editing ? resource === "users" ? userErrors : resource === "branches" ? branchErrors : validateSettings(form, resource, !editing.id) : {}; const validationMessages = Object.values(validationErrors); const dirty = editing ? formSignature(form) !== formSignature(initialForm) : false; const canSave = !!editing && dirty && !saving && Object.keys(validationErrors).length === 0;'
if old not in s:
    raise SystemExit("validation state block not found")
s = s.replace(old, new, 1)

old = 'const save = async () => { if (!editing || !canSave) return; setSaving(true); setError(""); try {'
new = 'const save = async () => { if (!editing || !canSave) return; setSaving(true); setError(""); setModalError(""); try {'
if old not in s:
    raise SystemExit("save start not found")
s = s.replace(old, new, 1)

old = '} catch (e) { setError(e instanceof Error ? e.message : "Save failed"); } finally { setSaving(false); } };'
new = '} catch (e) { setModalError(e instanceof Error ? e.message : "Save failed. Please review the fields and try again."); } finally { setSaving(false); } };'
if old not in s:
    raise SystemExit("save catch not found")
s = s.replace(old, new, 1)

old = '<CardContent className="p-5 space-y-5">\n      {resource === "users" ? <>'
new = '''<CardContent className="p-5 space-y-5">
      {(validationMessages.length > 0 || modalError) && <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 text-destructive px-4 py-3 space-y-1.5"><div className="font-semibold text-sm">Please fix the following before saving:</div>{modalError && <p className="text-sm">{modalError}</p>}{validationMessages.map((message, index) => <p key={`${message}-${index}`} className="text-sm">• {message}</p>)}</div>}
      {resource === "users" ? <>'''
if old not in s:
    raise SystemExit("modal content anchor not found")
s = s.replace(old, new, 1)

path.write_text(s, encoding="utf-8")
print("SMP-41 validation fix applied")
