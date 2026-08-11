import { useState, useMemo, useEffect } from "react";
import { useGetAnalyticsRange, useListOrders } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import {
  LayoutDashboard, Users, CreditCard, TrendingUp,
  PackageCheck, Clock, Zap, Search, ChevronLeft,
  ChevronRight, RefreshCw, CalendarDays, AlertCircle,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  getGetAnalyticsRangeQueryKey,
  getListOrdersQueryKey,
} from "@workspace/api-client-react";
// ── Types / constants ──────────────────────────────────────────────────────

type Preset = "today" | "yesterday" | "7d" | "30d" | "month" | "custom";

const PRESETS: { id: Preset; label: string }[] = [
  { id: "today",     label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "7d",        label: "Last 7 Days" },
  { id: "30d",       label: "Last 30 Days" },
  { id: "month",     label: "This Month" },
  { id: "custom",    label: "Custom" },
];

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  NEW:                 { label: "New",           cls: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  WAITING_PHOTOGRAPHY: { label: "Waiting Photo", cls: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300" },
  IN_PHOTOGRAPHY:      { label: "In Photo",      cls: "bg-sky-600 text-white" },
  WAITING_EDITING:     { label: "Waiting Edit",  cls: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" },
  EDITING:             { label: "Editing",       cls: "bg-violet-600 text-white" },
  WAITING_PRINT:       { label: "Waiting Print", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  PRINTING:            { label: "Printing",      cls: "bg-amber-600 text-white" },
  READY_FOR_DELIVERY:  { label: "Ready",         cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  DELIVERED:           { label: "Delivered",     cls: "bg-emerald-600 text-white" },
  CANCELLED:           { label: "Cancelled",     cls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
};

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Cash", visa: "Visa", instapay: "InstaPay", vodafone_cash: "Vodafone Cash",
};

const SERVICE_LABELS: Record<string, string> = {
  personal_photos_8pack: "Personal",
  card_photos_1pack:     "Card",
  card_photos_20pack:    "Card 20pk",
  urgent_fee:            "Urgent",
};

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

const PAGE_SIZE = 20;

// ── Helpers ────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function presetDates(preset: Preset): { from: string; to: string } {
  const t = todayStr();
  const shift = (days: number) => {
    const d = new Date(); d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };
  switch (preset) {
    case "today":     return { from: t, to: t };
    case "yesterday": return { from: shift(-1), to: shift(-1) };
    case "7d":        return { from: shift(-6), to: t };
    case "30d":       return { from: shift(-29), to: t };
    case "month":     return { from: t.slice(0, 8) + "01", to: t };
    default:          return { from: t, to: t };
  }
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

function fmtHour(h: number) {
  return h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function Admin() {
  const queryClient = useQueryClient();

  // Date range state
  const [preset, setPreset] = useState<Preset>("today");
  const [from,   setFrom]   = useState(todayStr);
  const [to,     setTo]     = useState(todayStr);

  const applyPreset = (p: Preset) => {
    setPreset(p);
    if (p !== "custom") {
      const d = presetDates(p);
      setFrom(d.from);
      setTo(d.to);
    }
  };

  // Orders table state
  const [search,        setSearch]        = useState("");
  const [searchInput,   setSearchInput]   = useState("");
  const [statusFilter,  setStatusFilter]  = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [page,          setPage]          = useState(1);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [from, to, statusFilter, paymentFilter]);

  // ── Data fetching ──────────────────────────────────────────────────────

  const analyticsParams = { from, to };
  const { data: stats, isLoading: statsLoading, dataUpdatedAt } = useGetAnalyticsRange(
    analyticsParams,
    { query: {
        queryKey: getGetAnalyticsRangeQueryKey(analyticsParams),
        refetchInterval: 30000,
        staleTime: 10000,
      } }
  );

  const ordersQueryParams = useMemo(() => ({
    from,
    to,
    ...(search        ? { search }               : {}),
    ...(statusFilter  ? { status: statusFilter as any } : {}),
  }), [from, to, search, statusFilter]);

  const { data: allOrders = [], isLoading: ordersLoading } = useListOrders(
    ordersQueryParams,
    {      query: {
        queryKey: getListOrdersQueryKey(ordersQueryParams),
        staleTime: 10000,
      } }
  );

  const filteredOrders = useMemo(() =>
    paymentFilter
      ? allOrders.filter((o) => o.paymentMethod === paymentFilter)
      : allOrders,
    [allOrders, paymentFilter]
  );

  const totalPages  = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const pageOrders  = filteredOrders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const isMultiDay  = from !== to;

  const refresh = () => {
    queryClient.invalidateQueries();
  };

  // ── Chart data ─────────────────────────────────────────────────────────

  const revenueTrendData = useMemo(() => {
    if (!stats) return [];
    if (isMultiDay) {
      return stats.dailyRevenue.map((d) => ({
        label: fmtDate(d.date),
        revenue: d.revenue,
        orders:  d.orders,
      }));
    }
    // Single day → hourly distribution (orders count, not revenue — API doesn't break revenue by hour)
    return stats.hourlyDistribution.map((h) => ({
      label:  fmtHour(h.hour),
      orders: h.count,
    }));
  }, [stats, isMultiDay]);

  const servicePieData = useMemo(() =>
    (stats?.serviceBreakdown ?? [])
      .filter((s) => s.serviceType !== "urgent_fee")
      .map((s) => ({ name: SERVICE_LABELS[s.serviceType] ?? s.serviceType, value: s.revenue })),
    [stats]
  );

  const paymentPieData = useMemo(() =>
    (stats?.paymentBreakdown ?? []).map((p) => ({
      name:  PAYMENT_LABELS[p.paymentMethod] ?? p.paymentMethod,
      value: p.revenue,
    })),
    [stats]
  );

  const hourlyBarData = useMemo(() =>
    (stats?.hourlyDistribution ?? []).map((h) => ({ hour: fmtHour(h.hour), count: h.count })),
    [stats]
  );

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto w-full space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            Admin Dashboard
          </h2>
          {dataUpdatedAt > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              Last updated {new Date(dataUpdatedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={refresh} className="self-start sm:self-auto gap-2">
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </Button>
      </div>

      {/* ── Date range bar ── */}
      <Card className="border-primary/20">
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground shrink-0">
              <CalendarDays className="w-4 h-4" />
              <span className="font-medium">Period:</span>
            </div>

            {/* Preset pills */}
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => applyPreset(p.id)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    preset === p.id
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Custom date inputs */}
            {preset === "custom" && (
              <div className="flex items-center gap-2 ml-auto">
                <input
                  type="date"
                  value={from}
                  max={to}
                  onChange={(e) => { setFrom(e.target.value); setPage(1); }}
                  className="border rounded-md px-2 py-1 text-sm bg-background h-8"
                />
                <span className="text-muted-foreground text-xs">to</span>
                <input
                  type="date"
                  value={to}
                  min={from}
                  max={todayStr()}
                  onChange={(e) => { setTo(e.target.value); setPage(1); }}
                  className="border rounded-md px-2 py-1 text-sm bg-background h-8"
                />
              </div>
            )}

            {preset !== "custom" && (
              <div className="ml-auto text-xs text-muted-foreground hidden sm:block">
                {from === to ? fmtDate(from) : `${fmtDate(from)} – ${fmtDate(to)}`}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        {[
          {
            label: "Total Orders",
            value: stats?.totalOrders ?? "—",
            icon: Users,
            color: "text-foreground",
            loading: statsLoading,
          },
          {
            label: "Total Revenue",
            value: stats ? formatCurrency(stats.totalRevenue) : "—",
            icon: TrendingUp,
            color: "text-primary",
            mono: true,
            loading: statsLoading,
          },
          {
            label: "Collected",
            value: stats ? formatCurrency(stats.collectedRevenue) : "—",
            icon: CreditCard,
            color: "text-emerald-600",
            mono: true,
            loading: statsLoading,
          },
          {
            label: "Outstanding",
            value: stats ? formatCurrency(stats.outstandingRevenue) : "—",
            icon: AlertCircle,
            color: stats && stats.outstandingRevenue > 0 ? "text-destructive" : "text-muted-foreground",
            mono: true,
            loading: statsLoading,
          },
          {
            label: "Avg Order",
            value: stats ? formatCurrency(stats.avgOrderValue) : "—",
            icon: Zap,
            color: "text-amber-600",
            mono: true,
            loading: statsLoading,
          },
          {
            label: "Delivered",
            value: stats?.deliveredOrders ?? "—",
            icon: PackageCheck,
            color: "text-emerald-600",
            loading: statsLoading,
          },
        ].map((card, i) => (
          <Card key={i} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium text-muted-foreground leading-tight">{card.label}</p>
                <card.icon className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
              </div>
              <div className={`mt-2 text-xl sm:text-2xl font-bold ${card.color} ${card.mono ? "font-mono" : ""} ${card.loading ? "animate-pulse bg-muted rounded w-20 h-7" : ""}`}>
                {card.loading ? "" : card.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Live ops strip */}
      {stats && (
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm">
            <Clock className="w-4 h-4 text-amber-600" />
            <span className="font-medium text-amber-800 dark:text-amber-300">{stats.ordersInProgress}</span>
            <span className="text-amber-700 dark:text-amber-400">in progress (live)</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-sm">
            <PackageCheck className="w-4 h-4 text-emerald-600" />
            <span className="font-medium text-emerald-800 dark:text-emerald-300">{stats.pendingPickups}</span>
            <span className="text-emerald-700 dark:text-emerald-400">awaiting pickup (live)</span>
          </div>
          {stats.urgentOrders > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm">
              <Zap className="w-4 h-4 text-red-600" />
              <span className="font-medium text-red-800 dark:text-red-300">{stats.urgentOrders}</span>
              <span className="text-red-700 dark:text-red-400">urgent orders</span>
            </div>
          )}
        </div>
      )}

      {/* ── Charts row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Revenue / Orders trend — spans 2 cols on lg */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              {isMultiDay ? "Daily Revenue" : "Orders by Hour"}
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[220px] sm:h-[260px]">
            {statsLoading ? (
              <div className="h-full flex items-center justify-center">
                <div className="animate-pulse text-muted-foreground text-sm">Loading…</div>
              </div>
            ) : revenueTrendData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No data for this period.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                {isMultiDay ? (
                  <AreaChart data={revenueTrendData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} angle={revenueTrendData.length > 10 ? -30 : 0} textAnchor={revenueTrendData.length > 10 ? "end" : "middle"} height={revenueTrendData.length > 10 ? 45 : 28} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}`} />
                    <Tooltip
                      formatter={(v: number, name: string) => [name === "revenue" ? formatCurrency(v) : v, name === "revenue" ? "Revenue" : "Orders"]}
                      contentStyle={{ backgroundColor: "hsl(var(--popover))", borderRadius: "8px", border: "1px solid hsl(var(--border))", fontSize: 12 }}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#revGrad)" dot={revenueTrendData.length <= 7 ? { r: 4, fill: "hsl(var(--primary))" } : false} />
                  </AreaChart>
                ) : (
                  <BarChart data={hourlyBarData} margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip
                      formatter={(v: number) => [v, "Orders"]}
                      contentStyle={{ backgroundColor: "hsl(var(--popover))", borderRadius: "8px", border: "1px solid hsl(var(--border))", fontSize: 12 }}
                    />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Service mix */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Service Mix</CardTitle>
          </CardHeader>
          <CardContent className="h-[220px] sm:h-[260px] flex items-center justify-center">
            {statsLoading ? (
              <div className="animate-pulse text-muted-foreground text-sm">Loading…</div>
            ) : servicePieData.length === 0 ? (
              <div className="text-muted-foreground text-sm">No data.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={servicePieData} cx="50%" cy="45%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                    {servicePieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ backgroundColor: "hsl(var(--popover))", borderRadius: "8px", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                  <Legend iconSize={10} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Payment methods row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {(stats?.paymentBreakdown ?? []).length === 0 && !statsLoading ? (
          <div className="sm:col-span-2 lg:col-span-4 text-center text-muted-foreground text-sm py-6 border-2 border-dashed rounded-lg">
            No payment data for this period.
          </div>
        ) : (
          (stats?.paymentBreakdown ?? []).map((p, i) => (
            <Card key={p.paymentMethod} className="border-l-4" style={{ borderLeftColor: CHART_COLORS[i % CHART_COLORS.length] }}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{PAYMENT_LABELS[p.paymentMethod] ?? p.paymentMethod}</span>
                  <span className="text-xs text-muted-foreground">{p.count} orders</span>
                </div>
                <div className="text-xl font-bold font-mono mt-1">{formatCurrency(p.revenue)}</div>
                {stats && stats.collectedRevenue > 0 && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {Math.round((p.revenue / stats.collectedRevenue) * 100)}% of collected
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* ── Orders table ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-semibold">Orders</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {filteredOrders.length} order{filteredOrders.length !== 1 ? "s" : ""} found
              </p>
            </div>
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search name, mobile, order #…"
                  className="pl-8 h-9 w-full sm:w-56 text-sm"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 rounded-md border bg-background px-2 text-sm text-foreground min-w-[140px]"
              >
                <option value="">All Statuses</option>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>

              <select
                value={paymentFilter}
                onChange={(e) => { setPaymentFilter(e.target.value); setPage(1); }}
                className="h-9 rounded-md border bg-background px-2 text-sm text-foreground min-w-[130px]"
              >
                <option value="">All Payments</option>
                {Object.entries(PAYMENT_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-left">
                  {["Order #", "Customer", "Services", "Total", "Paid", "Remaining", "Status", "Payment", "Date"].map((h) => (
                    <th key={h} className="px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ordersLoading && (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground text-sm animate-pulse">
                      Loading orders…
                    </td>
                  </tr>
                )}
                {!ordersLoading && pageOrders.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground text-sm">
                      No orders match the current filters.
                    </td>
                  </tr>
                )}
                {pageOrders.map((order) => {
                  const s = STATUS_CONFIG[order.status] ?? { label: order.status, cls: "bg-muted text-muted-foreground" };
                  const hasUrgent = order.services.some((sv: any) => sv.serviceType === "urgent_fee");
                  const remaining = parseFloat(String(order.remainingAmount));

                  return (
                    <tr key={order.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-medium text-primary whitespace-nowrap">
                        {order.orderNumber}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium truncate max-w-[120px]">{order.customerName ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{order.customerMobile}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {order.services
                            .filter((sv: any) => sv.serviceType !== "urgent_fee")
                            .map((sv: any, i: number) => (
                              <span key={i} className="text-xs bg-muted px-1.5 py-0.5 rounded whitespace-nowrap">
                                {SERVICE_LABELS[sv.serviceType] ?? sv.serviceType} ×{sv.quantity}
                              </span>
                            ))}
                          {hasUrgent && (
                            <span className="text-xs bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                              <Zap className="w-2.5 h-2.5" /> Urgent
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{formatCurrency(order.totalAmount)}</td>
                      <td className="px-4 py-3 font-mono text-xs whitespace-nowrap text-emerald-600">{formatCurrency(order.paidAmount)}</td>
                      <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">
                        <span className={remaining > 0 ? "text-destructive font-semibold" : "text-muted-foreground"}>
                          {formatCurrency(remaining)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${s.cls}`}>
                          {s.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {fmtDateTime(order.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="md:hidden divide-y">
            {ordersLoading && (
              <div className="p-8 text-center text-muted-foreground text-sm animate-pulse">Loading orders…</div>
            )}
            {!ordersLoading && pageOrders.length === 0 && (
              <div className="p-8 text-center text-muted-foreground text-sm">No orders match the current filters.</div>
            )}
            {pageOrders.map((order) => {
              const s = STATUS_CONFIG[order.status] ?? { label: order.status, cls: "bg-muted text-muted-foreground" };
              const hasUrgent = order.services.some((sv: any) => sv.serviceType === "urgent_fee");
              const remaining = parseFloat(String(order.remainingAmount));

              return (
                <div key={order.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-mono text-xs font-semibold text-primary">{order.orderNumber}</div>
                      <div className="font-medium text-sm mt-0.5">{order.customerName ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{order.customerMobile}</div>
                    </div>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${s.cls}`}>{s.label}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {order.services
                      .filter((sv: any) => sv.serviceType !== "urgent_fee")
                      .map((sv: any, i: number) => (
                        <span key={i} className="text-xs bg-muted px-1.5 py-0.5 rounded">
                          {SERVICE_LABELS[sv.serviceType] ?? sv.serviceType} ×{sv.quantity}
                        </span>
                      ))}
                    {hasUrgent && (
                      <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                        <Zap className="w-2.5 h-2.5" /> Urgent
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <div className="space-y-0.5">
                      <div className="flex gap-3">
                        <span className="text-muted-foreground">Total</span>
                        <span className="font-mono">{formatCurrency(order.totalAmount)}</span>
                      </div>
                      <div className="flex gap-3">
                        <span className="text-muted-foreground">Paid</span>
                        <span className="font-mono text-emerald-600">{formatCurrency(order.paidAmount)}</span>
                      </div>
                      {remaining > 0 && (
                        <div className="flex gap-3">
                          <span className="text-muted-foreground">Due</span>
                          <span className="font-mono text-destructive font-semibold">{formatCurrency(remaining)}</span>
                        </div>
                      )}
                    </div>
                    <div className="text-right text-muted-foreground">
                      <div>{PAYMENT_LABELS[order.paymentMethod]}</div>
                      <div>{fmtDateTime(order.createdAt)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t">
              <span className="text-xs text-muted-foreground">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredOrders.length)} of {filteredOrders.length}
              </span>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-xs px-2 text-muted-foreground">{page} / {totalPages}</span>
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
