import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Boxes, BriefcaseBusiness, Building2, KeyRound, PackageCheck, ShieldCheck, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type Permission = { key?: string; module?: string; action?: string };
type PermissionSet = Set<string>;

type SettingItem = { key: string; title: string; description: string; href: string; permission: string; icon: typeof Users };

const settingItems: SettingItem[] = [
  { key: "users", title: "Users", description: "Manage user accounts, credentials, roles and branch assignments.", href: "/admin/users", permission: "users.view", icon: Users },
  { key: "branches", title: "Branches", description: "Manage studio branches, contact details and managers.", href: "/admin/branches", permission: "branches.manage", icon: Building2 },
  { key: "roles", title: "Roles", description: "Create roles and control the permissions assigned to each role.", href: "/admin/roles", permission: "roles.manage", icon: ShieldCheck },
  { key: "permissions", title: "Permissions", description: "Manage the permission catalog used by roles and authorization.", href: "/admin/permissions", permission: "permissions.manage", icon: KeyRound },
  { key: "services", title: "Services", description: "Manage services available when creating studio orders.", href: "/admin/services", permission: "services.manage", icon: BriefcaseBusiness },
  { key: "packages", title: "Packages", description: "Manage service packages, pricing and availability.", href: "/admin/packages", permission: "packages.manage", icon: Boxes },
  { key: "inventory", title: "Inventory", description: "Manage inventory items, quantities and low-stock thresholds.", href: "/admin/inventory", permission: "inventory.view", icon: PackageCheck },
];

function buildPermissionSet(raw: unknown): PermissionSet {
  const result = new Set<string>();
  if (!Array.isArray(raw)) return result;
  raw.forEach((permission) => {
    if (typeof permission === "string") { result.add(permission.trim().toLowerCase()); return; }
    if (!permission || typeof permission !== "object") return;
    const item = permission as Permission;
    if (typeof item.key === "string" && item.key.trim()) result.add(item.key.trim().toLowerCase());
    if (typeof item.module === "string" && typeof item.action === "string" && item.module.trim() && item.action.trim()) result.add(`${item.module.trim().toLowerCase()}.${item.action.trim().toLowerCase()}`);
  });
  return result;
}

export default function SettingsHome() {
  const [permissions, setPermissions] = useState<PermissionSet>(new Set());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me", { headers: { Accept: "application/json" }, credentials: "same-origin", cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return [];
        const data = await response.json().catch(() => null);
        return Array.isArray(data?.user?.permissions) ? data.user.permissions : Array.isArray(data?.permissions) ? data.permissions : [];
      })
      .then((raw) => { if (!cancelled) { setPermissions(buildPermissionSet(raw)); setLoaded(true); } })
      .catch(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  const visibleItems = useMemo(() => loaded ? settingItems.filter((item) => permissions.has(item.permission)) : [], [loaded, permissions]);

  return (
    <div className="min-h-full bg-background p-5 md:p-8"><div className="mx-auto max-w-6xl">
      <div className="mb-8"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Administration</p><h1 className="mt-2 text-2xl md:text-3xl font-bold tracking-tight text-foreground">Settings</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Manage your studio master data and access controls. You only see areas your role is allowed to access.</p></div>
      {!loaded ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-36 rounded-xl border bg-card animate-pulse" />)}</div> : visibleItems.length > 0 ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{visibleItems.map((item) => { const Icon = item.icon; return <Link key={item.key} href={item.href} className="group block"><Card className="h-full border-border/70 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"><CardContent className="flex h-full min-h-36 flex-col p-5"><div className="flex items-start justify-between gap-4"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground"><Icon className="h-5 w-5" /></div><ArrowRight className="mt-2 h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" /></div><div className="mt-5"><h2 className="font-semibold text-foreground">{item.title}</h2><p className="mt-1 text-sm leading-5 text-muted-foreground">{item.description}</p></div></CardContent></Card></Link>; })}</div> : <Card><CardContent className="flex min-h-48 items-center justify-center p-8 text-center"><div><ShieldCheck className="mx-auto h-8 w-8 text-muted-foreground" /><h2 className="mt-3 font-semibold">No settings access</h2><p className="mt-1 text-sm text-muted-foreground">Your role does not have permission to manage any settings.</p></div></CardContent></Card>}
    </div></div>
  );
}
