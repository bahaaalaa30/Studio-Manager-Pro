import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getListOrdersQueryKey, useListOrders } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { Archive as ArchiveIcon, Search, ChevronLeft, ChevronRight, RefreshCw, X, Zap } from "lucide-react";

type SearchCriteria = {
  orderNumber: string; customerName: string; customerMobile: string; status: string;
  service: string; paymentStatus: string; from: string; to: string;
};

const EMPTY: SearchCriteria = { orderNumber: "", customerName: "", customerMobile: "", status: "", service: "", paymentStatus: "", from: "", to: "" };
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
const SERVICE_LABELS: Record<string, string> = { personal_photos_8pack: "Personal Photos", card_photos_1pack: "Card Photos", card_photos_20pack: "Card Photos 20 Pack", urgent_fee: "Urgent Fee" };
const PAGE_SIZE = 20;

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

export default function ArchiveSearch() {
  const queryClient = useQueryClient();
  const [criteria, setCriteria] = useState<SearchCriteria>(EMPTY);
  const [submitted, setSubmitted] = useState<SearchCriteria | null>(null);
  const [page, setPage] = useState(1);
  const hasCriteria = useMemo(() => Object.values(criteria).some((v) => v.trim() !== ""), [criteria]);
  const queryParams = useMemo(() => {
    if (!submitted) return {};
    const params: Record<string, string> = {};
    Object.entries(submitted).forEach(([key, value]) => { if (value.trim()) params[key] = value.trim(); });
    return params;
  }, [submitted]);

  const { data: orders = [], isLoading } = useListOrders(queryParams as any, {
    query: { queryKey: getListOrdersQueryKey(queryParams as any), enabled: submitted !== null, staleTime: 10000 },
  });
  const sortedOrders = useMemo(() => [...orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [orders]);
  const totalPages = Math.max(1, Math.ceil(sortedOrders.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageOrders = sortedOrders.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const update = (field: keyof SearchCriteria, value: string) => { setCriteria((c) => ({ ...c, [field]: value })); setPage(1); };
  const search = () => { if (hasCriteria) { setSubmitted({ ...criteria }); setPage(1); } };
  const clear = () => { setCriteria(EMPTY); setSubmitted(null); setPage(1); queryClient.removeQueries({ queryKey: ["/api/orders"] }); };
  const refresh = () => { if (submitted) void queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey(queryParams as any) }); };

  return <div className="p-4 sm:p-6 lg:p-8 max-w-[1500px] mx-auto w-full space-y-6">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div><h2 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2"><ArchiveIcon className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />Archive</h2><p className="text-sm text-muted-foreground mt-1">Search archived orders using one or more criteria.</p></div>
      {submitted && <Button variant="outline" size="sm" onClick={refresh} className="gap-2"><RefreshCw className="w-3.5 h-3.5" />Refresh Results</Button>}
    </div>

    <Card className="border-primary/20">
      <CardHeader className="pb-3"><CardTitle className="text-base">Search Criteria</CardTitle><p className="text-xs text-muted-foreground">Enter at least one criterion, then press Search. No archive data is loaded before searching.</p></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div><label className="text-xs font-medium mb-1.5 block">Order Number</label><Input placeholder="e.g. PS-20260816-0001" value={criteria.orderNumber} onChange={(e) => update("orderNumber", e.target.value)} /></div>
          <div><label className="text-xs font-medium mb-1.5 block">Customer Name</label><Input placeholder="Customer name" value={criteria.customerName} onChange={(e) => update("customerName", e.target.value)} /></div>
          <div><label className="text-xs font-medium mb-1.5 block">Customer Mobile</label><Input placeholder="01xxxxxxxxx" value={criteria.customerMobile} onChange={(e) => update("customerMobile", e.target.value)} /></div>
          <div><label className="text-xs font-medium mb-1.5 block">Status</label><select value={criteria.status} onChange={(e) => update("status", e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="">Any Status</option>{Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
          <div><label className="text-xs font-medium mb-1.5 block">Service</label><select value={criteria.service} onChange={(e) => update("service", e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="">Any Service</option>{Object.entries(SERVICE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div><label className="text-xs font-medium mb-1.5 block">Payment Status</label><select value={criteria.paymentStatus} onChange={(e) => update("paymentStatus", e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="">Any Payment Status</option><option value="paid">Paid</option><option value="partial">Partially Paid</option><option value="unpaid">Unpaid</option></select></div>
          <div><label className="text-xs font-medium mb-1.5 block">From Date</label><Input type="date" value={criteria.from} max={criteria.to || undefined} onChange={(e) => update("from", e.target.value)} /></div>
          <div><label className="text-xs font-medium mb-1.5 block">To Date</label><Input type="date" value={criteria.to} min={criteria.from || undefined} onChange={(e) => update("to", e.target.value)} /></div>
        </div>
        <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2 border-t"><Button variant="outline" onClick={clear} className="gap-2"><X className="w-4 h-4" />Clear</Button><Button onClick={search} disabled={!hasCriteria || isLoading} className="gap-2"><Search className="w-4 h-4" />Search</Button></div>
      </CardContent>
    </Card>

    {!submitted ? <Card><CardContent className="py-16 text-center"><Search className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" /><h3 className="font-semibold">Search the archive</h3><p className="text-sm text-muted-foreground mt-1">Enter your search criteria above to retrieve archived orders.</p></CardContent></Card> :
      <Card><CardHeader className="pb-3"><div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2"><div><CardTitle className="text-base">Archived Orders <span className="text-xs font-normal text-muted-foreground">{isLoading ? "Searching…" : `${sortedOrders.length} found`}</span></CardTitle><p className="text-xs text-muted-foreground mt-1">Newest orders first.</p></div>{sortedOrders.length > 0 && <span className="text-xs text-muted-foreground">Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, sortedOrders.length)}</span>}</div></CardHeader>
        <CardContent className="p-0">
          <div className="hidden md:block overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b bg-muted/30 text-left">{["Order #", "Customer", "Services", "Total", "Paid", "Remaining", "Status", "Payment", "Date"].map((h) => <th key={h} className="px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>)}</tr></thead><tbody>
            {isLoading && <tr><td colSpan={9} className="px-4 py-14 text-center text-muted-foreground animate-pulse">Searching archived orders…</td></tr>}
            {!isLoading && pageOrders.length === 0 && <tr><td colSpan={9} className="px-4 py-14 text-center text-muted-foreground">No orders match the selected criteria.</td></tr>}
            {pageOrders.map((order) => { const status = STATUS_CONFIG[order.status] ?? { label: order.status, cls: "bg-muted text-muted-foreground" }; const urgent = order.services.some((s: any) => s.serviceType === "urgent_fee"); const remaining = parseFloat(String(order.remainingAmount)); return <tr key={order.id} className="border-b hover:bg-muted/30 transition-colors"><td className="px-4 py-3 font-mono text-xs font-medium text-primary whitespace-nowrap">{order.orderNumber}</td><td className="px-4 py-3"><div className="font-medium truncate max-w-[150px]">{order.customerName ?? "—"}</div><div className="text-xs text-muted-foreground">{order.customerMobile}</div></td><td className="px-4 py-3"><div className="flex flex-wrap gap-1">{order.services.filter((s: any) => s.serviceType !== "urgent_fee").map((s: any, i: number) => <span key={i} className="text-xs bg-muted px-1.5 py-0.5 rounded whitespace-nowrap">{SERVICE_LABELS[s.serviceType] ?? s.serviceType} ×{s.quantity}</span>)}{urgent && <span className="text-xs bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 px-1.5 py-0.5 rounded flex items-center gap-0.5"><Zap className="w-2.5 h-2.5" />Urgent</span>}</div></td><td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{formatCurrency(order.totalAmount)}</td><td className="px-4 py-3 font-mono text-xs text-emerald-600 whitespace-nowrap">{formatCurrency(order.paidAmount)}</td><td className="px-4 py-3 font-mono text-xs whitespace-nowrap"><span className={remaining > 0 ? "text-destructive font-semibold" : "text-muted-foreground"}>{formatCurrency(remaining)}</span></td><td className="px-4 py-3"><span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${status.cls}`}>{status.label}</span></td><td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod}</td><td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtDateTime(order.createdAt)}</td></tr>; })}
          </tbody></table></div>
          <div className="md:hidden divide-y">{isLoading && <div className="p-8 text-center text-muted-foreground animate-pulse">Searching archived orders…</div>}{!isLoading && pageOrders.length === 0 && <div className="p-8 text-center text-muted-foreground">No orders match the selected criteria.</div>}{pageOrders.map((order) => { const status = STATUS_CONFIG[order.status] ?? { label: order.status, cls: "bg-muted text-muted-foreground" }; const remaining = parseFloat(String(order.remainingAmount)); return <div key={order.id} className="p-4 space-y-2.5"><div className="flex items-start justify-between gap-3"><div><div className="font-mono text-xs font-semibold text-primary">{order.orderNumber}</div><div className="font-medium text-sm mt-0.5">{order.customerName ?? "—"}</div><div className="text-xs text-muted-foreground">{order.customerMobile}</div></div><span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${status.cls}`}>{status.label}</span></div><div className="flex flex-wrap gap-1">{order.services.map((s: any, i: number) => <span key={i} className="text-xs bg-muted px-1.5 py-0.5 rounded">{SERVICE_LABELS[s.serviceType] ?? s.serviceType} ×{s.quantity}</span>)}</div><div className="grid grid-cols-2 gap-2 text-xs"><div>Total: <b>{formatCurrency(order.totalAmount)}</b></div><div>Paid: <b>{formatCurrency(order.paidAmount)}</b></div><div>Remaining: <b className={remaining > 0 ? "text-destructive" : ""}>{formatCurrency(remaining)}</b></div><div>Payment: <b>{PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod}</b></div></div><div className="text-xs text-muted-foreground">{fmtDateTime(order.createdAt)}</div></div>; })}</div>
          {totalPages > 1 && <div className="flex items-center justify-between p-3 border-t"><span className="text-xs text-muted-foreground">Page {currentPage} of {totalPages}</span><div className="flex gap-2"><Button variant="outline" size="icon" disabled={currentPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}><ChevronLeft className="w-4 h-4" /></Button><Button variant="outline" size="icon" disabled={currentPage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}><ChevronRight className="w-4 h-4" /></Button></div></div>}
        </CardContent></Card>}
  </div>;
}
