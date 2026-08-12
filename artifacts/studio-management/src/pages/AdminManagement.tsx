import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Plus, Search, Pencil, Trash2, ArrowLeft, ShieldCheck, Building2, Users, KeyRound, BriefcaseBusiness, Boxes, PackageCheck, SlidersHorizontal, ChevronLeft, ChevronRight, X, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const configs = {
  users: { title: "Users", description: "Manage staff accounts, roles and branch assignments.", icon: Users, fields: ["name", "username", "role_id", "branch_id", "status"], labels: { name: "Name", username: "Username", role_id: "Role ID", branch_id: "Branch ID", status: "Status" } },
  branches: { title: "Branches", description: "Manage studio branches and branch managers.", icon: Building2, fields: ["name", "code", "address", "phone", "manager_user_id", "status"], labels: { name: "Branch Name", code: "Code", address: "Address", phone: "Phone", manager_user_id: "Manager User ID", status: "Status" } },
  roles: { title: "Roles", description: "Define reusable staff roles and access levels.", icon: ShieldCheck, fields: ["name", "description", "status"], labels: { name: "Role Name", description: "Description", status: "Status" } },
  permissions: { title: "Permissions", description: "Define granular actions available to roles.", icon: KeyRound, fields: ["key", "name", "module", "action", "description"], labels: { key: "Permission Key", name: "Name", module: "Module", action: "Action", description: "Description" } },
  services: { title: "Services", description: "Manage services used when creating orders.", icon: BriefcaseBusiness, fields: ["name", "code", "price", "description", "status"], labels: { name: "Service Name", code: "Code", price: "Price", description: "Description", status: "Status" } },
  packages: { title: "Packages", description: "Manage service packages and their pricing.", icon: Boxes, fields: ["name", "code", "price", "description", "status"], labels: { name: "Package Name", code: "Code", price: "Price", description: "Description", status: "Status" } },
  inventory: { title: "Inventory Items", description: "Manage inventory master items and low-stock thresholds.", icon: PackageCheck, fields: ["name", "sku", "category", "unit", "quantity", "minimum_quantity", "status"], labels: { name: "Item Name", sku: "SKU", category: "Category", unit: "Unit", quantity: "Quantity", minimum_quantity: "Minimum Quantity", status: "Status" } },
} as const;
type Resource = keyof typeof configs;
type RecordData = Record<string, unknown> & { id?: number };

const navigation: { key: Resource; label: string }[] = [
  { key: "users", label: "Users" }, { key: "branches", label: "Branches" }, { key: "roles", label: "Roles" },
  { key: "permissions", label: "Permissions" }, { key: "services", label: "Services" }, { key: "packages", label: "Packages" }, { key: "inventory", label: "Inventory" },
];

function display(value: unknown) { return value === null || value === undefined || value === "" ? "—" : String(value); }
function inputType(field: string) { return ["price", "quantity", "minimum_quantity", "role_id", "branch_id", "manager_user_id"].includes(field) ? "number" : "text"; }
function statusClass(value: unknown) { const s = String(value ?? "").toLowerCase(); return s === "active" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : s === "inactive" || s === "disabled" ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"; }

export default function AdminManagement({ resource }: { resource: Resource }) {
  const config = configs[resource];
  const Icon = config.icon;
  const [rows, setRows] = useState<RecordData[]>([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<RecordData | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const load = async (query = search) => {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/admin/${resource}${query ? `?search=${encodeURIComponent(query)}` : ""}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to load");
      setRows(Array.isArray(data) ? data : data.items ?? []); setPage(1);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to load"); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(""); }, [resource]);

  const openCreate = () => { setEditing({}); setForm({}); setError(""); };
  const openEdit = (row: RecordData) => {
    setEditing(row); setForm(Object.fromEntries(config.fields.map((f) => [f, row[f] === null || row[f] === undefined ? "" : String(row[f])] ))); setError("");
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
    if (!window.confirm("Delete this record? This action cannot be undone.")) return;
    try {
      const response = await fetch(`/api/admin/${resource}/${id}`, { method: "DELETE" });
      if (!response.ok) { const data = await response.json(); throw new Error(data.error || "Delete failed"); }
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Delete failed"); }
  };

  const columns = useMemo(() => config.fields.slice(0, resource === "permissions" ? 5 : 6), [config.fields, resource]);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const visibleRows = rows.slice((page - 1) * pageSize, page * pageSize);
  const start = rows.length ? (page - 1) * pageSize + 1 : 0;
  const end = Math.min(page * pageSize, rows.length);

  return <div className="p-4 sm:p-6 lg:p-8 max-w-[1500px] mx-auto w-full space-y-5">
    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
      <div className="flex items-start gap-3 min-w-0">
        <Link href="/admin"><Button variant="outline" size="icon" className="shrink-0 mt-0.5"><ArrowLeft className="w-4 h-4" /></Button></Link>
        <div className="min-w-0"><div className="flex items-center gap-2"><div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><Icon className="w-5 h-5 text-primary" /></div><h2 className="text-xl sm:text-2xl font-bold tracking-tight">{config.title}</h2></div><p className="text-sm text-muted-foreground mt-2 max-w-2xl">{config.description}</p></div>
      </div>
      <Button onClick={openCreate} className="gap-2 shrink-0"><Plus className="w-4 h-4" />Add {config.title.replace(/s$/, "")}</Button>
    </div>

    <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none border-b">
      {navigation.map((item) => <Link key={item.key} href={`/admin/${item.key}`}><button className={`px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${resource === item.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{item.label}</button></Link>)}
    </div>

    <Card className="overflow-hidden"><CardContent className="p-3 sm:p-4"><div className="flex flex-col sm:flex-row gap-2"><div className="relative flex-1"><Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" /><Input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void load(); }} placeholder={`Search ${config.title.toLowerCase()}...`} className="pl-9 h-9" /></div><Button onClick={() => void load()} variant="outline" className="gap-2 h-9"><Search className="w-4 h-4" />Search</Button><Button onClick={() => { setSearch(""); void load(""); }} variant="ghost" className="gap-2 h-9"><SlidersHorizontal className="w-4 h-4" />Reset</Button></div></CardContent></Card>

    {error && <div className="rounded-lg border border-destructive/30 bg-destructive/5 text-destructive px-4 py-3 text-sm flex items-center justify-between gap-3"><span>{error}</span><button onClick={() => setError("")}><X className="w-4 h-4" /></button></div>}

    <Card><CardHeader className="py-4 border-b"><div className="flex items-center justify-between gap-3"><div><CardTitle className="text-sm font-semibold">{config.title}</CardTitle><p className="text-xs text-muted-foreground mt-1">{rows.length} total record{rows.length === 1 ? "" : "s"}</p></div></div></CardHeader><CardContent className="p-0 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b bg-muted/30">{columns.map((c) => <th key={c} className="text-left font-medium text-muted-foreground px-4 py-3 whitespace-nowrap">{config.labels[c as keyof typeof config.labels]}</th>)}<th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th></tr></thead><tbody>{loading ? <tr><td colSpan={columns.length + 1} className="p-12 text-center text-muted-foreground">Loading {config.title.toLowerCase()}…</td></tr> : visibleRows.length === 0 ? <tr><td colSpan={columns.length + 1} className="p-12 text-center"><div className="mx-auto h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-3"><Icon className="w-5 h-5 text-muted-foreground" /></div><p className="font-medium">No {config.title.toLowerCase()} found</p><p className="text-xs text-muted-foreground mt-1">Try a different search or add a new record.</p></td></tr> : visibleRows.map((row) => <tr key={row.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">{columns.map((c) => <td key={c} className="px-4 py-3 whitespace-nowrap max-w-[280px] truncate">{c === "status" ? <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(row[c])}`}>{display(row[c])}</span> : c === "price" || c === "quantity" || c === "minimum_quantity" ? <span className="font-mono">{display(row[c])}</span> : display(row[c])}</td>)}<td className="px-4 py-3"><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" onClick={() => openEdit(row)} aria-label="Edit"><Pencil className="w-4 h-4" /></Button><Button variant="ghost" size="icon" onClick={() => void remove(Number(row.id))} aria-label="Delete"><Trash2 className="w-4 h-4 text-destructive" /></Button></div></td></tr>)}</tbody></table></CardContent><div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-t text-xs text-muted-foreground"><span>{start}–{end} of {rows.length}</span><div className="flex items-center gap-1"><Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}><ChevronLeft className="w-4 h-4" /></Button><span className="px-2">Page {page} of {totalPages}</span><Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}><ChevronRight className="w-4 h-4" /></Button></div></div></Card>

    {editing && <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"><Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"><CardHeader className="sticky top-0 z-10 bg-card border-b flex flex-row items-center justify-between"><div><CardTitle>{editing.id ? "Edit" : "Add"} {config.title.replace(/s$/, "")}</CardTitle><p className="text-xs text-muted-foreground mt-1">Keep the master data consistent across the studio.</p></div><Button variant="ghost" size="icon" onClick={() => setEditing(null)}><X className="w-4 h-4" /></Button></CardHeader><CardContent className="space-y-4 p-5">{config.fields.map((field) => <div key={field} className="space-y-1.5"><Label>{config.labels[field as keyof typeof config.labels]}</Label><Input type={inputType(field)} value={form[field] ?? ""} onChange={(e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))} placeholder={String(config.labels[field as keyof typeof config.labels])} /></div>)}<div className="flex justify-end gap-2 pt-3 border-t"><Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button><Button onClick={() => void save()} disabled={saving} className="gap-2"><Save className="w-4 h-4" />{saving ? "Saving…" : "Save changes"}</Button></div></CardContent></Card></div>}
  </div>;
}
