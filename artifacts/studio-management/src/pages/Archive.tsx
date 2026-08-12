import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getListOrdersQueryKey, useListOrders } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { Archive as ArchiveIcon, Search, ChevronLeft, ChevronRight, RefreshCw, CalendarDays, X, Zap } from "lucide-react";

type Preset = "all" | "today" | "yesterday" | "7d" | "30d" | "month" | "custom";

const PRESETS: { id: Preset; label: string }[] = [
  { id: "all", label: "All Time" }, { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" }, { id: "7d", label: "Last 7 Days" },
  { id: "30d", label: "Last 30 Days" }, { id: "month", label: "This Month" }, { id: "custom", label: "Custom" },
];

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  NEW: { label: "New", cls: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  WAITING_PHOTOGRAPHY: { label: "Waiting Photo", cls: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300" },
  IN_PHOTOGRAPHY: { label: "In Photo", cls: "bg-sky-600 text-white" },
  WAITING_EDITING: { label: "Waiting Edit", cls: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" },
  EDITING: { label: "Editing", cls: "bg-violet-600 text-white" },
  WAITING_PRINT: { label: "Waiting Print", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  PRINTING: { label: "Printing", cls: "bg-amber-600 text-white" },
  READY_FOR_DELIVERY: { label: "Ready", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  DELIVERED: { label: "Delivered", cls: "bg-emerald-600 text-white" },
  CANCELLED: { label: "Cancelled", cls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
};

const PAYMENT_LABELS: Record<string, string> = { cash: "Cash", visa: "Visa", instapay: "InstaPay", vodafone_cash: "Vodafone Cash" };
const SERVICE_LABELS: Record<string, string> = {
  personal_photos_8pack: "Personal", card_photos_1pack: "Card", card_photos_20pack: "Card 20pk", urgent_fee: "Urgent",
};
const PAGE_SIZE = 20;

function todayStr() { return new Date().toISOString().slice(0, 10); }
function datesFor(preset: Preset) {
  const today = todayStr();
  const shift = (days: number) => { const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };
  if (preset === "today") return { from: today, to: today };
  if (preset === "yesterday") return { from: shift(-1), to: shift(-1) };
  if (preset === "7d") return { from: shift(-6), to: today };
  if (preset === "30d") return { from: shift(-29), to: today };
  if (preset === "month") return { from: today.slice(0, 8) + "01", to: today };
  return null;
}
function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

export default function Archive() {
  const queryClient = useQueryClient();
  const [preset, setPreset] = useState<Preset>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);
  useEffect(() => { setPage(1); }, [from, to, statusFilter, paymentFilter]);

  const applyPreset = (next: Preset) => {
    setPreset(next);
    if (next === "all") { setFrom(""); setTo(""); return; }
    if (next === "custom") return;
    const dates = datesFor(next);
    if (dates) { setFrom(dates.from); setTo(dates.to); }
  };

  const queryParams = useMemo(() => {
    const params: Record<string, string> = {};
    if (from && to) { params.from = from; params.to = to; }
    if (search) params.search = search;
    if (statusFilter) params.status = statusFilter;
    return params;
  }, [from, to, search, statusFilter]);

  const { data: allOrders = [], isLoading } = useListOrders(queryParams as any, {
    query: { queryKey: getListOrdersQueryKey(queryParams as any), staleTime: 10000 },
  });

  const filteredOrders = useMemo(() => {
    const orders = paymentFilter ? allOrders.filter((o) => o.paymentMethod === paymentFilter) : allOrders;
    return [...orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [allOrders, paymentFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageOrders = filteredOrders.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const clearFilters = () => { setPreset("all"); setFrom(""); setTo(""); setSearchInput(""); setSearch(""); setStatusFilter(""); setPaymentFilter(""); setPage(1); };
  const hasFilters = Boolean(searchInput || statusFilter || paymentFilter || preset !== "all");

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1500px] mx-auto w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2"><ArchiveIcon className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />Archive</h2>
          <p className="text-sm text-muted-foreground mt-1">Search and retrieve historical orders quickly.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries()} className="gap-2"><RefreshCw className="w-3.5 h-3.5" />Refresh</Button>
      </div>

      <Card className="border-primary/20">
        <CardContent className="p-3 sm:p-4 space-y-3">
          <div className="flex flex-col xl:flex-row xl:items-center gap-3">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground"><CalendarDays className="w-4 h-4" /><span className="font-medium">Period:</span></div>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((item) => <button key={item.id} onClick={() => applyPreset(item.id)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${preset === item.id ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>{item.label}</button>)}
            </div>
            {preset === "custom" && <div className="flex items-center gap-2 xl:ml-auto"><input type="date" value={from} max={to || todayStr()} onChange={(e) => setFrom(e.target.value)} className="border rounded-md px-2 py-1 text-sm bg-background h-8" /><span className="text-xs text-muted-foreground">to</span><input type="date" value={to} min={from || undefined} max={todayStr()} onChange={(e) => setTo(e.target.value)} className="border rounded-md px-2 py-1 text-sm bg-background h-8" /></div>}
          </div>
          <div className="flex flex-col md:flex-row gap-2">
            <div className="relative flex-1"><Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" /><Input placeholder="Search name, mobile, order #…" className="pl-9 h-10 text-sm" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} /></div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm min-w-[170px]"><option value="">All Statuses</option>{Object.entries(STATUS_CONFIG).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select>
            <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm min-w-[150px]"><option value="">All Payments</option>{Object.entries(PAYMENT_LABELS).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select>
            {hasFilters && <Button variant="ghost" size="sm" onClick={clearFilters} className="h-10 gap-1.5"><X className="w-3.5 h-3.5" />Clear</Button>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2"><div><CardTitle className="text-base font-semibold">Archived Orders <span className="text-xs font-normal text-muted-foreground">{filteredOrders.length} found</span></CardTitle><p className="text-xs text-muted-foreground mt-1">Newest orders first. Search covers customer name, mobile and order number.</p></div>{filteredOrders.length > 0 && <span className="text-xs text-muted-foreground">Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredOrders.length)}</span>}</div></CardHeader>
        <CardContent className="p-0">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm"><thead><tr className="border-b bg-muted/30 text-left">{["Order #", "Customer", "Services", "Total", "Paid", "Remaining", "Status", "Payment", "Date"].map((h) => <th key={h} className="px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>)}</tr></thead>
              <tbody>
                {isLoading && <tr><td colSpan={9} className="px-4 py-14 text-center text-muted-foreground animate-pulse">Loading archived orders…</td></tr>}
                {!isLoading && pageOrders.length === 0 && <tr><td colSpan={9} className="px-4 py-14 text-center text-muted-foreground">No orders match the current search and filters.</td></tr>}
                {pageOrders.map((order) => { const status = STATUS_CONFIG[order.status] ?? { label: order.status, cls: "bg-muted text-muted-foreground" }; const urgent = order.services.some((s: any) => s.serviceType === "urgent_fee"); const remaining = parseFloat(String(order.remainingAmount)); return <tr key={order.id} className="border-b hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs font-medium text-primary whitespace-nowrap">{order.orderNumber}</td>
                  <td className="px-4 py-3"><div className="font-medium truncate max-w-[150px]">{order.customerName ?? "—"}</div><div className="text-xs text-muted-foreground">{order.customerMobile}</div></td>
                  <td className="px-4 py-3"><div className="flex flex-wrap gap-1">{order.services.filter((s: any) => s.serviceType !== "urgent_fee").map((s: any, i: number) => <span key={i} className="text-xs bg-muted px-1.5 py-0.5 rounded whitespace-nowrap">{SERVICE_LABELS[s.serviceType] ?? s.serviceType} ×{s.quantity}</span>)}{urgent && <span className="text-xs bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 px-1.5 py-0.5 rounded flex items-center gap-0.5"><Zap className="w-2.5 h-2.5" />Urgent</span>}</div></td>
                  <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{formatCurrency(order.totalAmount)}</td><td className="px-4 py-3 font-mono text-xs text-emerald-600 whitespace-nowrap">{formatCurrency(order.paidAmount)}</td>
                  <td className="px-4 py-3 font-mono text-xs whitespace-nowrap"><span className={remaining > 0 ? "text-destructive font-semibold" : "text-muted-foreground"}>{formatCurrency(remaining)}</span></td>
                  <td className="px-4 py-3"><span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${status.cls}`}>{status.label}</span></td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod}</td><td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtDateTime(order.createdAt)}</td>
                </tr>; })}
              </tbody>
            </table>
          </div>

          <div className="md:hidden divide-y">
            {isLoading && <div className="p-8 text-center text-muted-foreground animate-pulse">Loading archived orders…</div>}
            {!isLoading && pageOrders.length === 0 && <div className="p-8 text-center text-muted-foreground">No orders match the current search and filters.</div>}
            {pageOrders.map((order) => { const status = STATUS_CONFIG[order.status] ?? { label: order.status, cls: "bg-muted text-muted-foreground" }; const urgent = order.services.some((s: any) => s.serviceType === "urgent_fee"); const remaining = parseFloat(String(order.remainingAmount)); return <div key={order.id} className="p-4 space-y-2.5">
              <div className="flex items-start justify-between gap-3"><div><div className="font-mono text-xs font-semibold text-primary">{order.orderNumber}</div><div className="font-medium text-sm mt-0.5">{order.customerName ?? "—"}</div><div className="text-xs text-muted-foreground">{order.customerMobile}</div></div><span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${status.cls}`}>{status.label}</span></div>
              <div className="flex flex-wrap gap-1">{order.services.filter((s: any) => s.serviceType !== "urgent_fee").map((s: any, i: number) => <span key={i} className="text-xs bg-muted px-1.5 py-0.5 rounded">{SERVICE_LABELS[s.serviceType] ?? s.serviceType} ×{s.quantity}</span>)}{urgent && <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded"><Zap className="inline w-2.5 h-2.5" /> Urgent</span>}</div>
              <div className="flex items-end justify-between text-xs"><div className="space-y-1"><div className="flex gap-3"><span className="text-muted-foreground">Total</span><span className="font-mono">{formatCurrency(order.totalAmount)}</span></div><div className="flex gap-3"><span className="text-muted-foreground">Paid</span><span className="font-mono text-emerald-600">{formatCurrency(order.paidAmount)}</span></div>{remaining > 0 && <div className="flex gap-3"><span className="text-muted-foreground">Due</span><span className="font-mono text-destructive font-semibold">{formatCurrency(remaining)}</span></div>}</div><div className="text-right text-muted-foreground"><div>{PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod}</div><div>{fmtDateTime(order.createdAt)}</div></div></div>
            </div>; })}
          </div>

          {totalPages > 1 && <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-t"><span className="text-xs text-muted-foreground">Page {currentPage} of {totalPages} · {filteredOrders.length} matching orders</span><div className="flex items-center gap-1"><Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronLeft className="w-4 h-4" /></Button><span className="text-xs px-2 text-muted-foreground">{currentPage} / {totalPages}</span><Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}><ChevronRight className="w-4 h-4" /></Button></div></div>}
        </CardContent>
      </Card>
    </div>
  );
}
