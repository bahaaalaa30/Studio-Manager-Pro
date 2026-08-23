import { useMemo, useState } from "react";
import { useGetAnalyticsRange } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { LayoutDashboard, Users, CreditCard, TrendingUp, PackageCheck, Clock, RefreshCw, CalendarDays, AlertCircle, Download, Search } from "lucide-react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { getGetAnalyticsRangeQueryKey } from "@workspace/api-client-react";

type Preset = "today" | "yesterday" | "7d" | "30d" | "month" | "custom";
type AnalyticsOrder = {
  id: number;
  orderNumber: string;
  customerName: string | null;
  customerMobile: string;
  customerType: string;
  services: Array<{ serviceType?: string; serviceName?: string; quantity?: number; unitPrice?: number; totalPrice?: number; urgent?: boolean }>;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentMethod: string;
  expectedDeliveryTime: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};
type PaymentAnalytics = { paymentMethod: string; revenue: number; count: number; percentage?: number };
type AnalyticsResponse = { orders?: AnalyticsOrder[]; paymentBreakdown?: PaymentAnalytics[]; [key: string]: any };

const PRESETS: { id: Preset; label: string }[] = [
  { id: "today", label: "Today" }, { id: "yesterday", label: "Yesterday" }, { id: "7d", label: "Last 7 Days" }, { id: "30d", label: "Last 30 Days" }, { id: "month", label: "This Month" }, { id: "custom", label: "Custom" },
];
const SERVICE_LABELS: Record<string, string> = { personal_photos_8pack: "Personal", card_photos_1pack: "Card", card_photos_20pack: "Card 20pk", urgent_fee: "Urgent" };
const CHART_COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];
const PAYMENT_LABELS: Record<string, string> = { cash: "Cash", visa: "Visa", instapay: "Instapay", vodafone_cash: "Vodafone Cash" };
function todayStr() { return new Date().toISOString().slice(0, 10); }
function presetDates(preset: Preset) {
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
function fmtDateTime(iso: string) { return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
function fmtHour(h: number) { return h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`; }
function csvCell(value: unknown) { return `"${String(value ?? "").replace(/"/g, '""')}"`; }

export default function Admin() {
  const queryClient = useQueryClient();
  const [preset, setPreset] = useState<Preset>("today");
  const [from, setFrom] = useState(todayStr);
  const [to, setTo] = useState(todayStr);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const applyPreset = (next: Preset) => { setPreset(next); if (next !== "custom") { const dates = presetDates(next); setFrom(dates.from); setTo(dates.to); } };
  const params = { from, to };
  const { data: stats, isLoading: statsLoading, dataUpdatedAt } = useGetAnalyticsRange(params, { query: { queryKey: getGetAnalyticsRangeQueryKey(params), refetchInterval: 30000, staleTime: 10000 } });
  const analytics = stats as AnalyticsResponse | undefined;
  const orders = analytics?.orders ?? [];
  const paymentBreakdown = analytics?.paymentBreakdown ?? [];
  const isMultiDay = from !== to;
  const revenueTrendData = useMemo(() => !stats ? [] : isMultiDay ? stats.dailyRevenue.map((d) => ({ label: fmtDate(d.date), revenue: d.revenue, orders: d.orders })) : stats.hourlyDistribution.map((h) => ({ label: fmtHour(h.hour), orders: h.count })), [stats, isMultiDay]);
  const servicePieData = useMemo(() => (stats?.serviceBreakdown ?? []).filter((s) => s.serviceType !== "urgent_fee").map((s) => ({ name: SERVICE_LABELS[s.serviceType] ?? s.serviceType, value: s.revenue })), [stats]);
  const paymentPieData = useMemo(() => paymentBreakdown.map((p) => ({ name: PAYMENT_LABELS[p.paymentMethod] ?? p.paymentMethod, value: Number(p.revenue) || 0 })), [paymentBreakdown]);
  const paymentRevenueTotal = useMemo(() => paymentBreakdown.reduce((sum, p) => sum + (Number(p.revenue) || 0), 0), [paymentBreakdown]);
  const statusOptions = useMemo(() => Array.from(new Set(orders.map((order) => order.status))).sort(), [orders]);
  const paymentOptions = useMemo(() => Array.from(new Set(orders.map((order) => order.paymentMethod))).sort(), [orders]);
  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((order) => {
      if (statusFilter !== "all" && order.status !== statusFilter) return false;
      if (paymentFilter !== "all" && order.paymentMethod !== paymentFilter) return false;
      if (!q) return true;
      const serviceText = order.services.map((s) => `${s.serviceName ?? s.serviceType ?? ""} ${s.serviceType ?? ""}`).join(" ");
      return [order.orderNumber, order.customerName, order.customerMobile, order.customerType, order.status, order.paymentMethod, serviceText].filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  }, [orders, search, statusFilter, paymentFilter]);
  const exportOrders = () => {
    const headers = ["ID", "Order Number", "Customer Name", "Mobile", "Customer Type", "Services", "Total", "Paid", "Remaining", "Payment Method", "Expected Delivery", "Status", "Created At", "Updated At"];
    const rows = filteredOrders.map((order) => [order.id, order.orderNumber, order.customerName ?? "", order.customerMobile, order.customerType, order.services.map((s) => `${s.quantity ?? 0}x ${s.serviceName ?? s.serviceType ?? ""} @ ${s.unitPrice ?? 0} = ${s.totalPrice ?? 0}`).join(" | "), order.totalAmount, order.paidAmount, order.remainingAmount, order.paymentMethod, order.expectedDeliveryTime ? fmtDateTime(order.expectedDeliveryTime) : "", order.status, fmtDateTime(order.createdAt), fmtDateTime(order.updatedAt)]);
    const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `smp-orders-${from}-to-${to}.csv`; anchor.click(); URL.revokeObjectURL(url);
  };

  return <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto w-full space-y-6">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><h2 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2"><LayoutDashboard className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />Orders Analytics</h2>{dataUpdatedAt > 0 && <p className="text-xs text-muted-foreground mt-1">Last updated {new Date(dataUpdatedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</p>}</div><div className="flex gap-2"><Button variant="outline" size="sm" onClick={exportOrders} disabled={!filteredOrders.length} className="gap-2"><Download className="w-3.5 h-3.5" />Export CSV</Button><Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries()} className="gap-2"><RefreshCw className="w-3.5 h-3.5" />Refresh</Button></div></div>
    <Card className="border-primary/20"><CardContent className="p-3 sm:p-4"><div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center"><div className="flex items-center gap-1.5 text-sm text-muted-foreground shrink-0"><CalendarDays className="w-4 h-4" /><span className="font-medium">Period:</span></div><div className="flex flex-wrap gap-1.5">{PRESETS.map((p) => <button key={p.id} onClick={() => applyPreset(p.id)} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${preset === p.id ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>{p.label}</button>)}</div>{preset === "custom" && <div className="flex items-center gap-2 ml-auto"><input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="border rounded-md px-2 py-1 text-sm bg-background h-8" /><span className="text-muted-foreground text-xs">to</span><input type="date" value={to} min={from} max={todayStr()} onChange={(e) => setTo(e.target.value)} className="border rounded-md px-2 py-1 text-sm bg-background h-8" /></div>}</div></CardContent></Card>
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">{[{ label: "Total Orders", value: stats?.totalOrders ?? "—", icon: Users, color: "text-foreground" }, { label: "Total Revenue", value: stats ? formatCurrency(stats.totalRevenue) : "—", icon: TrendingUp, color: "text-primary", mono: true }, { label: "Collected", value: stats ? formatCurrency(stats.collectedRevenue) : "—", icon: CreditCard, color: "text-emerald-600", mono: true }, { label: "Outstanding", value: stats ? formatCurrency(stats.outstandingRevenue) : "—", icon: AlertCircle, color: stats && stats.outstandingRevenue > 0 ? "text-destructive" : "text-muted-foreground", mono: true }, { label: "Avg Order", value: stats ? formatCurrency(stats.avgOrderValue) : "—", icon: Clock, color: "text-amber-600", mono: true }, { label: "Delivered", value: stats?.deliveredOrders ?? "—", icon: PackageCheck, color: "text-emerald-600" }].map((card, i) => <Card key={i}><CardContent className="p-4"><div className="flex items-start justify-between"><p className="text-xs font-medium text-muted-foreground">{card.label}</p><card.icon className="w-3.5 h-3.5 text-muted-foreground" /></div><div className={`mt-2 text-xl font-bold ${card.color} ${card.mono ? "font-mono" : ""}`}>{statsLoading ? "…" : card.value}</div></CardContent></Card>)}</div>
    {stats && <div className="flex flex-wrap gap-3"><div className="flex items-center gap-2 px-4 py-2 rounded-full bg-amber-50 dark:bg-amber-900/20 border text-sm"><Clock className="w-4 h-4 text-amber-600" /><span className="font-medium">{stats.ordersInProgress}</span><span>in progress</span></div><div className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 dark:bg-emerald-900/20 border text-sm"><PackageCheck className="w-4 h-4 text-emerald-600" /><span className="font-medium">{stats.pendingPickups}</span><span>awaiting pickup</span></div><div className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary/5 border text-sm"><span className="font-medium">{orders.length}</span><span>orders loaded</span></div></div>}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4"><Card className="lg:col-span-2"><CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">{isMultiDay ? "Daily Revenue" : "Orders by Hour"}</CardTitle></CardHeader><CardContent className="h-[260px]">{statsLoading ? <div className="h-full flex items-center justify-center text-muted-foreground">Loading…</div> : revenueTrendData.length === 0 ? <div className="h-full flex items-center justify-center text-muted-foreground">No data for this period.</div> : <ResponsiveContainer width="100%" height="100%">{isMultiDay ? <AreaChart data={revenueTrendData}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" /><YAxis /><Tooltip /><Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="hsl(var(--primary)/.12)" /></AreaChart> : <BarChart data={revenueTrendData}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="orders" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} /></BarChart>}</ResponsiveContainer>}</CardContent></Card><Card><CardHeader><CardTitle className="text-sm font-semibold">Service Mix</CardTitle></CardHeader><CardContent className="h-[260px]">{servicePieData.length === 0 ? <div className="h-full flex items-center justify-center text-muted-foreground">No data.</div> : <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={servicePieData} cx="50%" cy="45%" innerRadius={55} outerRadius={80} dataKey="value">{servicePieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}</Pie><Tooltip formatter={(v: number) => formatCurrency(v)} /><Legend iconSize={10} /></PieChart></ResponsiveContainer>}</CardContent></Card></div>
    <Card><CardHeader><CardTitle className="text-sm font-semibold">Payment Methods Analytics</CardTitle></CardHeader><CardContent><div className="grid grid-cols-1 lg:grid-cols-2 gap-6"><div className="h-[260px]">{paymentPieData.length === 0 ? <div className="h-full flex items-center justify-center text-muted-foreground">No payment data for this period.</div> : <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={paymentPieData} cx="50%" cy="45%" innerRadius={55} outerRadius={85} dataKey="value"><Cell fill="hsl(var(--chart-1))" /><Cell fill="hsl(var(--chart-2))" /><Cell fill="hsl(var(--chart-3))" /><Cell fill="hsl(var(--chart-4))" /></Pie><Tooltip formatter={(v: number) => formatCurrency(v)} /><Legend iconSize={10} /></PieChart></ResponsiveContainer>}</div><div className="space-y-2"><div className="grid grid-cols-4 gap-2 px-3 py-2 text-xs font-semibold text-muted-foreground border-b"><span>Method</span><span>Orders</span><span>Revenue</span><span>Share</span></div>{paymentBreakdown.map((p) => { const share = p.percentage ?? (paymentRevenueTotal > 0 ? (p.revenue / paymentRevenueTotal) * 100 : 0); return <div key={p.paymentMethod} className="grid grid-cols-4 gap-2 px-3 py-2 text-sm border-b last:border-0"><span className="font-medium">{PAYMENT_LABELS[p.paymentMethod] ?? p.paymentMethod}</span><span>{p.count}</span><span className="font-mono">{formatCurrency(p.revenue)}</span><span>{share.toFixed(1)}%</span></div>; })}{paymentBreakdown.length > 0 && <div className="grid grid-cols-4 gap-2 px-3 py-2 text-sm font-semibold"><span>Total</span><span>{paymentBreakdown.reduce((s, p) => s + p.count, 0)}</span><span className="font-mono">{formatCurrency(paymentRevenueTotal)}</span><span>100%</span></div>}</div></div></CardContent></Card>
    <Card><CardHeader className="pb-3"><div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3"><CardTitle className="text-sm font-semibold">All Orders</CardTitle><div className="flex flex-col sm:flex-row gap-2"><div className="relative"><Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search order, customer, mobile, service..." className="h-8 w-full sm:w-72 rounded-md border bg-background pl-8 pr-3 text-xs outline-none focus:ring-1 focus:ring-primary" /></div><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-8 rounded-md border bg-background px-2 text-xs"><option value="all">All statuses</option>{statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}</select><select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} className="h-8 rounded-md border bg-background px-2 text-xs"><option value="all">All payments</option>{paymentOptions.map((method) => <option key={method} value={method}>{PAYMENT_LABELS[method] ?? method}</option>)}</select></div></div></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full text-xs"><thead className="bg-muted/50 border-y"><tr>{["ID", "Order", "Customer", "Mobile", "Services", "Total", "Paid", "Remaining", "Payment", "Expected Delivery", "Status", "Created", "Updated"].map((head) => <th key={head} className="px-3 py-2 text-left font-semibold whitespace-nowrap">{head}</th>)}</tr></thead><tbody>{statsLoading ? <tr><td colSpan={13} className="p-8 text-center text-muted-foreground">Loading orders…</td></tr> : filteredOrders.length === 0 ? <tr><td colSpan={13} className="p-8 text-center text-muted-foreground">No orders match the current filters.</td></tr> : filteredOrders.map((order) => <tr key={order.id} className="border-b hover:bg-muted/30 align-top"><td className="px-3 py-2 font-mono">{order.id}</td><td className="px-3 py-2 font-medium whitespace-nowrap">{order.orderNumber}</td><td className="px-3 py-2 max-w-[180px] break-words">{order.customerName || "Walk-in"}</td><td className="px-3 py-2 whitespace-nowrap">{order.customerMobile}</td><td className="px-3 py-2 min-w-[240px]"><div className="space-y-1">{order.services.map((service, index) => <div key={`${order.id}-${index}`}><span className="font-medium">{service.quantity ?? 0}× {service.serviceName ?? SERVICE_LABELS[service.serviceType ?? ""] ?? service.serviceType}</span><span className="text-muted-foreground"> · {formatCurrency(Number(service.unitPrice ?? 0))} × {service.quantity ?? 0} = {formatCurrency(Number(service.totalPrice ?? 0))}</span>{service.urgent && <span className="ml-1 text-destructive">(urgent)</span>}</div>)}</div></td><td className="px-3 py-2 font-mono whitespace-nowrap">{formatCurrency(order.totalAmount)}</td><td className="px-3 py-2 font-mono whitespace-nowrap text-emerald-600">{formatCurrency(order.paidAmount)}</td><td className={`px-3 py-2 font-mono whitespace-nowrap ${order.remainingAmount > 0 ? "text-destructive" : ""}`}>{formatCurrency(order.remainingAmount)}</td><td className="px-3 py-2 whitespace-nowrap">{PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod}</td><td className="px-3 py-2 whitespace-nowrap">{order.expectedDeliveryTime ? fmtDateTime(order.expectedDeliveryTime) : "—"}</td><td className="px-3 py-2 whitespace-nowrap"><span className="rounded-full bg-muted px-2 py-1 font-medium">{order.status}</span></td><td className="px-3 py-2 whitespace-nowrap">{fmtDateTime(order.createdAt)}</td><td className="px-3 py-2 whitespace-nowrap">{fmtDateTime(order.updatedAt)}</td></tr>)}</tbody></table></div><div className="border-t px-3 py-2 text-xs text-muted-foreground">Showing {filteredOrders.length} of {orders.length} orders for {fmtDate(from)} to {fmtDate(to)}.</div></CardContent></Card>
  </div>;
}
