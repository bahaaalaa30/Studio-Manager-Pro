import { useMemo, useState } from "react";
import { useGetAnalyticsRange } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import {
  LayoutDashboard, Users, CreditCard, TrendingUp, PackageCheck, Clock, Zap,
  RefreshCw, CalendarDays, AlertCircle,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { getGetAnalyticsRangeQueryKey } from "@workspace/api-client-react";

type Preset = "today" | "yesterday" | "7d" | "30d" | "month" | "custom";
const PRESETS: { id: Preset; label: string }[] = [
  { id: "today", label: "Today" }, { id: "yesterday", label: "Yesterday" },
  { id: "7d", label: "Last 7 Days" }, { id: "30d", label: "Last 30 Days" },
  { id: "month", label: "This Month" }, { id: "custom", label: "Custom" },
];
const PAYMENT_LABELS: Record<string, string> = {
  cash: "Cash", visa: "Visa", instapay: "InstaPay", vodafone_cash: "Vodafone Cash",
};
const SERVICE_LABELS: Record<string, string> = {
  personal_photos_8pack: "Personal", card_photos_1pack: "Card", card_photos_20pack: "Card 20pk", urgent_fee: "Urgent",
};
const CHART_COLORS = [
  "hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))",
  "hsl(var(--chart-4))", "hsl(var(--chart-5))",
];
function todayStr() { return new Date().toISOString().slice(0, 10); }
function presetDates(preset: Preset): { from: string; to: string } {
  const today = todayStr();
  const shift = (days: number) => { const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };
  if (preset === "today") return { from: today, to: today };
  if (preset === "yesterday") return { from: shift(-1), to: shift(-1) };
  if (preset === "7d") return { from: shift(-6), to: today };
  if (preset === "30d") return { from: shift(-29), to: today };
  if (preset === "month") return { from: today.slice(0, 8) + "01", to: today };
  return { from: today, to: today };
}
function fmtDate(iso: string) { return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); }
function fmtHour(h: number) { return h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`; }

export default function Admin() {
  const queryClient = useQueryClient();
  const [preset, setPreset] = useState<Preset>("today");
  const [from, setFrom] = useState(todayStr);
  const [to, setTo] = useState(todayStr);
  const applyPreset = (next: Preset) => {
    setPreset(next);
    if (next !== "custom") { const dates = presetDates(next); setFrom(dates.from); setTo(dates.to); }
  };
  const params = { from, to };
  const { data: stats, isLoading: statsLoading, dataUpdatedAt } = useGetAnalyticsRange(params, {
    query: { queryKey: getGetAnalyticsRangeQueryKey(params), refetchInterval: 30000, staleTime: 10000 },
  });
  const isMultiDay = from !== to;
  const revenueTrendData = useMemo(() => {
    if (!stats) return [];
    if (isMultiDay) return stats.dailyRevenue.map((d) => ({ label: fmtDate(d.date), revenue: d.revenue, orders: d.orders }));
    return stats.hourlyDistribution.map((h) => ({ label: fmtHour(h.hour), orders: h.count }));
  }, [stats, isMultiDay]);
  const servicePieData = useMemo(() => (stats?.serviceBreakdown ?? []).filter((s) => s.serviceType !== "urgent_fee").map((s) => ({ name: SERVICE_LABELS[s.serviceType] ?? s.serviceType, value: s.revenue })), [stats]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2"><LayoutDashboard className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />Admin Dashboard</h2>
          {dataUpdatedAt > 0 && <p className="text-xs text-muted-foreground mt-1">Last updated {new Date(dataUpdatedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</p>}
        </div>
        <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries()} className="gap-2"><RefreshCw className="w-3.5 h-3.5" />Refresh</Button>
      </div>

      <Card className="border-primary/20"><CardContent className="p-3 sm:p-4"><div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground shrink-0"><CalendarDays className="w-4 h-4" /><span className="font-medium">Period:</span></div>
        <div className="flex flex-wrap gap-1.5">{PRESETS.map((p) => <button key={p.id} onClick={() => applyPreset(p.id)} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${preset === p.id ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>{p.label}</button>)}</div>
        {preset === "custom" && <div className="flex items-center gap-2 ml-auto"><input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="border rounded-md px-2 py-1 text-sm bg-background h-8" /><span className="text-muted-foreground text-xs">to</span><input type="date" value={to} min={from} max={todayStr()} onChange={(e) => setTo(e.target.value)} className="border rounded-md px-2 py-1 text-sm bg-background h-8" /></div>}
        {preset !== "custom" && <div className="ml-auto text-xs text-muted-foreground hidden sm:block">{from === to ? fmtDate(from) : `${fmtDate(from)} – ${fmtDate(to)}`}</div>}
      </div></CardContent></Card>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        {[
          { label: "Total Orders", value: stats?.totalOrders ?? "—", icon: Users, color: "text-foreground" },
          { label: "Total Revenue", value: stats ? formatCurrency(stats.totalRevenue) : "—", icon: TrendingUp, color: "text-primary", mono: true },
          { label: "Collected", value: stats ? formatCurrency(stats.collectedRevenue) : "—", icon: CreditCard, color: "text-emerald-600", mono: true },
          { label: "Outstanding", value: stats ? formatCurrency(stats.outstandingRevenue) : "—", icon: AlertCircle, color: stats && stats.outstandingRevenue > 0 ? "text-destructive" : "text-muted-foreground", mono: true },
          { label: "Avg Order", value: stats ? formatCurrency(stats.avgOrderValue) : "—", icon: Zap, color: "text-amber-600", mono: true },
          { label: "Delivered", value: stats?.deliveredOrders ?? "—", icon: PackageCheck, color: "text-emerald-600" },
        ].map((card, i) => <Card key={i} className="overflow-hidden"><CardContent className="p-4"><div className="flex items-start justify-between gap-2"><p className="text-xs font-medium text-muted-foreground leading-tight">{card.label}</p><card.icon className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" /></div><div className={`mt-2 text-xl sm:text-2xl font-bold ${card.color} ${card.mono ? "font-mono" : ""} ${statsLoading ? "animate-pulse bg-muted rounded w-20 h-7" : ""}`}>{statsLoading ? "" : card.value}</div></CardContent></Card>)}
      </div>

      {stats && <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm"><Clock className="w-4 h-4 text-amber-600" /><span className="font-medium text-amber-800 dark:text-amber-300">{stats.ordersInProgress}</span><span className="text-amber-700 dark:text-amber-400">in progress (live)</span></div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-sm"><PackageCheck className="w-4 h-4 text-emerald-600" /><span className="font-medium text-emerald-800 dark:text-emerald-300">{stats.pendingPickups}</span><span className="text-emerald-700 dark:text-emerald-400">awaiting pickup (live)</span></div>
        {stats.urgentOrders > 0 && <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm"><Zap className="w-4 h-4 text-red-600" /><span className="font-medium text-red-800 dark:text-red-300">{stats.urgentOrders}</span><span className="text-red-700 dark:text-red-400">urgent orders</span></div>}
      </div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2"><CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">{isMultiDay ? "Daily Revenue" : "Orders by Hour"}</CardTitle></CardHeader><CardContent className="h-[220px] sm:h-[260px]">
          {statsLoading ? <div className="h-full flex items-center justify-center"><div className="animate-pulse text-muted-foreground text-sm">Loading…</div></div> : revenueTrendData.length === 0 ? <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No data for this period.</div> : <ResponsiveContainer width="100%" height="100%">
            {isMultiDay ? <AreaChart data={revenueTrendData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}><defs><linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} /><stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" /><XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} /><YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} /><Tooltip formatter={(v: number, name: string) => [name === "revenue" ? formatCurrency(v) : v, name === "revenue" ? "Revenue" : "Orders"]} /><Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#revGrad)" /></AreaChart> : <BarChart data={stats.hourlyDistribution.map((h) => ({ hour: fmtHour(h.hour), count: h.count }))} margin={{ top: 10, right: 10, left: -10, bottom: 10 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" /><XAxis dataKey="hour" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} /><YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} allowDecimals={false} /><Tooltip formatter={(v: number) => [v, "Orders"]} /><Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} /></BarChart>}
          </ResponsiveContainer>}
        </CardContent></Card>

        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Service Mix</CardTitle></CardHeader><CardContent className="h-[220px] sm:h-[260px] flex items-center justify-center">
          {statsLoading ? <div className="animate-pulse text-muted-foreground text-sm">Loading…</div> : servicePieData.length === 0 ? <div className="text-muted-foreground text-sm">No data.</div> : <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={servicePieData} cx="50%" cy="45%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">{servicePieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}</Pie><Tooltip formatter={(v: number) => formatCurrency(v)} /><Legend iconSize={10} iconType="circle" wrapperStyle={{ fontSize: 11 }} /></PieChart></ResponsiveContainer>}
        </CardContent></Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {(stats?.paymentBreakdown ?? []).length === 0 && !statsLoading ? <div className="sm:col-span-2 lg:col-span-4 text-center text-muted-foreground text-sm py-6 border-2 border-dashed rounded-lg">No payment data for this period.</div> : (stats?.paymentBreakdown ?? []).map((p, i) => <Card key={p.paymentMethod} className="border-l-4" style={{ borderLeftColor: CHART_COLORS[i % CHART_COLORS.length] }}><CardContent className="p-4"><div className="flex items-center justify-between"><span className="text-sm font-medium">{PAYMENT_LABELS[p.paymentMethod] ?? p.paymentMethod}</span><span className="text-xs text-muted-foreground">{p.count} orders</span></div><div className="text-xl font-bold font-mono mt-1">{formatCurrency(p.revenue)}</div>{stats && stats.collectedRevenue > 0 && <div className="text-xs text-muted-foreground mt-1">{Math.round((p.revenue / stats.collectedRevenue) * 100)}% of collected</div>}</CardContent></Card>)}
      </div>
    </div>
  );
}
