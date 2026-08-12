import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Plus, Search, Pencil, Trash2, ArrowLeft, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const configs = {
  users: { title: "Users", description: "Manage staff accounts, roles and branch assignments.", fields: ["name", "username", "role_id", "branch_id", "status"], labels: { name: "Name", username: "Username", role_id: "Role ID", branch_id: "Branch ID", status: "Status" } },
  branches: { title: "Branches", description: "Manage studio branches and branch managers.", fields: ["name", "code", "address", "phone", "manager_user_id", "status"], labels: { name: "Branch Name", code: "Code", address: "Address", phone: "Phone", manager_user_id: "Manager User ID", status: "Status" } },
  roles: { title: "Roles", description: "Define reusable staff roles.", fields: ["name", "description", "status"], labels: { name: "Role Name", description: "Description", status: "Status" } },
  permissions: { title: "Permissions", description: "Define granular actions available to roles.", fields: ["key", "name", "module", "action", "description"], labels: { key: "Permission Key", name: "Name", module: "Module", action: "Action", description: "Description" } },
  services: { title: "Services", description: "Manage services used when creating orders.", fields: ["name", "code", "price", "description", "status"], labels: { name: "Service Name", code: "Code", price: "Price", description: "Description", status: "Status" } },
  packages: { title: "Packages", description: "Manage service packages and their pricing.", fields: ["name", "code", "price", "description", "status"], labels: { name: "Package Name", code: "Code", price: "Price", description: "Description", status: "Status" } },
  inventory: { title: "Inventory Items", description: "Manage inventory master items and low-stock thresholds.", fields: ["name", "sku", "category", "unit", "quantity", "minimum_quantity", "status"], labels: { name: "Item Name", sku: "SKU", category: "Category", unit: "Unit", quantity: "Quantity", minimum_quantity: "Minimum Quantity", status: "Status" } },
} as const;
type Resource = keyof typeof configs;
type RecordData = Record<string, unknown> & { id?: number };

function display(value: unknown) { return value === null || value === undefined || value === "" ? "—" : String(value); }
function inputType(field: string) { return ["price", "quantity", "minimum_quantity", "role_id", "branch_id", "manager_user_id"].includes(field) ? "number" : "text"; }

export default function AdminManagement({ resource }: { resource: Resource }) {
  const config = configs[resource];
  const [rows, setRows] = useState<RecordData[]>([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<RecordData | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/admin/${resource}${search ? `?search=${encodeURIComponent(search)}` : ""}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to load");
      setRows(data);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to load"); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [resource]);

  const openCreate = () => { setEditing({}); setForm({}); setError(""); };
  const openEdit = (row: RecordData) => {
    setEditing(row);
    setForm(Object.fromEntries(config.fields.map((f) => [f, row[f] === null || row[f] === undefined ? "" : String(row[f])] )));
    setError("");
  };
  const save = async () => {
    setSaving(true); setError("");
    try {
      const body: Record<string, unknown> = {};
      for (const field of config.fields) {
        if (form[field] === undefined || form[field] === "") continue;
        body[field] = inputType(field) === "number" ? Number(form[field]) : form[field];
      }
      const response = await fetch(editing?.id ? `/api/admin/${resource}/${editing.id}` : `/api/admin/${resource}`, { method: editing?.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Save failed");
      setEditing(null); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Save failed"); }
    finally { setSaving(false); }
  };
  const remove = async (id: number) => {
    if (!window.confirm("Delete this record?")) return;
    try {
      const response = await fetch(`/api/admin/${resource}/${id}`, { method: "DELETE" });
      if (!response.ok) { const data = await response.json(); throw new Error(data.error || "Delete failed"); }
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Delete failed"); }
  };

  const columns = useMemo(() => config.fields.slice(0, resource === "permissions" ? 5 : 6), [config.fields, resource]);

  return <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto w-full space-y-5">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <Link href="/admin"><Button variant="outline" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
        <div><h2 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-primary" />{config.title}</h2><p className="text-sm text-muted-foreground mt-1">{config.description}</p></div>
      </div>
      <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" />Add {config.title.replace(/s$/, "")}</Button>
    </div>

    <Card><CardContent className="p-4"><form onSubmit={(e) => { e.preventDefault(); void load(); }} className="flex gap-2"><div className="relative flex-1"><Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search ${config.title.toLowerCase()}...`} className="pl-9" /></div><Button type="submit" variant="outline">Search</Button></form></CardContent></Card>

    {error && <div className="rounded-md border border-destructive/30 bg-destructive/5 text-destructive px-4 py-3 text-sm">{error}</div>}
    <Card><CardHeader><CardTitle className="text-sm font-semibold">{rows.length} record{rows.length === 1 ? "" : "s"}</CardTitle></CardHeader><CardContent className="p-0 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-t border-b bg-muted/30">{columns.map((c) => <th key={c} className="text-left font-medium px-4 py-3 whitespace-nowrap">{config.labels[c as keyof typeof config.labels]}</th>)}<th className="px-4 py-3 text-right">Actions</th></tr></thead><tbody>{loading ? <tr><td colSpan={columns.length + 1} className="p-8 text-center text-muted-foreground">Loading…</td></tr> : rows.length === 0 ? <tr><td colSpan={columns.length + 1} className="p-8 text-center text-muted-foreground">No records found.</td></tr> : rows.map((row) => <tr key={row.id} className="border-b last:border-0 hover:bg-muted/20">{columns.map((c) => <td key={c} className="px-4 py-3 whitespace-nowrap max-w-[260px] truncate">{display(row[c])}</td>)}<td className="px-4 py-3"><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" onClick={() => openEdit(row)} aria-label="Edit"><Pencil className="w-4 h-4" /></Button><Button variant="ghost" size="icon" onClick={() => void remove(Number(row.id))} aria-label="Delete"><Trash2 className="w-4 h-4 text-destructive" /></Button></div></td></tr>)}</tbody></table></CardContent></Card>

    {editing && <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"><Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto"><CardHeader><CardTitle>{editing.id ? "Edit" : "Add"} {config.title.replace(/s$/, "")}</CardTitle></CardHeader><CardContent className="space-y-4">{config.fields.map((field) => <div key={field} className="space-y-1.5"><Label>{config.labels[field as keyof typeof config.labels]}</Label><Input type={inputType(field)} value={form[field] ?? ""} onChange={(e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))} placeholder={String(config.labels[field as keyof typeof config.labels])} /></div>)}<div className="flex justify-end gap-2 pt-2"><Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button><Button onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Save"}</Button></div></CardContent></Card></div>}
  </div>;
}
