import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getListOrdersQueryKey, useListOrders } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { Archive as ArchiveIcon, Search, RefreshCw, X, ChevronLeft, ChevronRight } from "lucide-react";

type Criteria = { orderNumber:string; customerName:string; customerMobile:string; status:string; service:string; paymentStatus:string; from:string; to:string };
const EMPTY: Criteria = { orderNumber:"", customerName:"", customerMobile:"", status:"", service:"", paymentStatus:"", from:"", to:"" };
const STATUSES = ["NEW","WAITING_PHOTOGRAPHY","IN_PHOTOGRAPHY","WAITING_EDITING","EDITING","WAITING_PRINT","PRINTING","READY_FOR_DELIVERY","DELIVERED","CANCELLED"];
const SERVICES: Record<string,string> = { personal_photos_8pack:"Personal Photos", card_photos_1pack:"Card Photos", card_photos_20pack:"Card Photos 20 Pack", urgent_fee:"Urgent Fee" };
const PAYMENTS: Record<string,string> = { cash:"Cash", visa:"Visa", instapay:"InstaPay", vodafone_cash:"Vodafone Cash" };
const PAGE_SIZE = 20;

export default function ArchiveSearchV2() {
  const queryClient = useQueryClient();
  const [criteria,setCriteria] = useState<Criteria>(EMPTY);
  const [submitted,setSubmitted] = useState<Criteria|null>(null);
  const [page,setPage] = useState(1);
  const hasCriteria = Object.values(criteria).some(Boolean);
  const params = useMemo(() => {
    if (!submitted) return {};
    return Object.fromEntries(Object.entries(submitted).filter(([,v]) => v.trim()).map(([k,v]) => [k,v.trim()]));
  },[submitted]);
  const {data:orders=[],isLoading} = useListOrders(params as any,{query:{queryKey:getListOrdersQueryKey(params as any),enabled:submitted!==null,staleTime:10000}});
  const sorted = useMemo(()=>[...orders].sort((a,b)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime()),[orders]);
  const totalPages=Math.max(1,Math.ceil(sorted.length/PAGE_SIZE));
  const currentPage=Math.min(page,totalPages);
  const pageOrders=sorted.slice((currentPage-1)*PAGE_SIZE,currentPage*PAGE_SIZE);
  const set=(field:keyof Criteria,value:string)=>{setCriteria(c=>({...c,[field]:value}));setPage(1)};
  const search=()=>{if(hasCriteria){setSubmitted({...criteria});setPage(1)}};
  const clear=()=>{setCriteria(EMPTY);setSubmitted(null);setPage(1);queryClient.removeQueries({queryKey:["/api/orders"]})};
  const refresh=()=>{if(submitted) void queryClient.invalidateQueries({queryKey:getListOrdersQueryKey(params as any)})};
  return <div className="p-4 sm:p-6 lg:p-8 max-w-[1500px] mx-auto w-full space-y-6">
    <div className="flex items-center justify-between gap-3"><div><h2 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2"><ArchiveIcon className="w-6 h-6 text-primary"/>Archive</h2><p className="text-sm text-muted-foreground mt-1">Search and retrieve historical orders.</p></div>{submitted&&<Button variant="outline" size="sm" onClick={refresh} className="gap-2"><RefreshCw className="w-4 h-4"/>Refresh Results</Button>}</div>
    <Card className="border-primary/30 shadow-sm">
      <CardHeader className="pb-3"><CardTitle className="text-base sm:text-lg">Search Criteria</CardTitle><p className="text-xs sm:text-sm text-muted-foreground">Enter one or more criteria, then click Search. No archived orders are loaded until Search is pressed.</p></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div><label className="text-sm font-medium mb-1.5 block">Order Number</label><Input value={criteria.orderNumber} onChange={e=>set("orderNumber",e.target.value)} placeholder="Order number" /></div>
          <div><label className="text-sm font-medium mb-1.5 block">Customer Name</label><Input value={criteria.customerName} onChange={e=>set("customerName",e.target.value)} placeholder="Customer name" /></div>
          <div><label className="text-sm font-medium mb-1.5 block">Customer Mobile</label><Input value={criteria.customerMobile} onChange={e=>set("customerMobile",e.target.value)} placeholder="01xxxxxxxxx" /></div>
          <div><label className="text-sm font-medium mb-1.5 block">Status</label><select value={criteria.status} onChange={e=>set("status",e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="">Any Status</option>{STATUSES.map(s=><option key={s} value={s}>{s.replaceAll("_"," ")}</option>)}</select></div>
          <div><label className="text-sm font-medium mb-1.5 block">Service</label><select value={criteria.service} onChange={e=>set("service",e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="">Any Service</option>{Object.entries(SERVICES).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div>
          <div><label className="text-sm font-medium mb-1.5 block">Payment Status</label><select value={criteria.paymentStatus} onChange={e=>set("paymentStatus",e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="">Any Payment Status</option><option value="paid">Paid</option><option value="partial">Partially Paid</option><option value="unpaid">Unpaid</option></select></div>
          <div><label className="text-sm font-medium mb-1.5 block">From Date</label><Input type="date" value={criteria.from} max={criteria.to||undefined} onChange={e=>set("from",e.target.value)}/></div>
          <div><label className="text-sm font-medium mb-1.5 block">To Date</label><Input type="date" value={criteria.to} min={criteria.from||undefined} onChange={e=>set("to",e.target.value)}/></div>
        </div>
        <div className="flex flex-col sm:flex-row justify-end gap-2 border-t pt-4"><Button variant="outline" onClick={clear} className="gap-2"><X className="w-4 h-4"/>Clear</Button><Button onClick={search} disabled={!hasCriteria||isLoading} className="gap-2"><Search className="w-4 h-4"/>Search</Button></div>
      </CardContent>
    </Card>
    {!submitted ? <Card><CardContent className="py-16 text-center"><Search className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50"/><h3 className="font-semibold">Search the archive</h3><p className="text-sm text-muted-foreground mt-1">Enter your search criteria above to retrieve archived orders.</p></CardContent></Card> : <Card><CardHeader className="pb-3"><CardTitle className="text-base">Archived Orders <span className="text-xs font-normal text-muted-foreground">{isLoading?"Searching…":`${sorted.length} found`}</span></CardTitle></CardHeader><CardContent className="p-0 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b bg-muted/30 text-left">{["Order #","Customer","Total","Paid","Remaining","Status","Payment","Date"].map(h=><th key={h} className="px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>)}</tr></thead><tbody>{isLoading&&<tr><td colSpan={8} className="p-12 text-center text-muted-foreground">Searching archived orders…</td></tr>}{!isLoading&&!pageOrders.length&&<tr><td colSpan={8} className="p-12 text-center text-muted-foreground">No orders match the selected criteria.</td></tr>}{pageOrders.map(o=>{const remaining=parseFloat(String(o.remainingAmount));return <tr key={o.id} className="border-b hover:bg-muted/30"><td className="px-4 py-3 font-mono text-xs text-primary">{o.orderNumber}</td><td className="px-4 py-3"><div className="font-medium">{o.customerName||"—"}</div><div className="text-xs text-muted-foreground">{o.customerMobile}</div></td><td className="px-4 py-3">{formatCurrency(o.totalAmount)}</td><td className="px-4 py-3 text-emerald-600">{formatCurrency(o.paidAmount)}</td><td className="px-4 py-3">{formatCurrency(remaining)}</td><td className="px-4 py-3">{o.status}</td><td className="px-4 py-3 text-xs">{PAYMENTS[o.paymentMethod]||o.paymentMethod}</td><td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{new Date(o.createdAt).toLocaleString()}</td></tr>})}</tbody></table>{totalPages>1&&<div className="flex items-center justify-between p-3 border-t"><span className="text-xs text-muted-foreground">Page {currentPage} of {totalPages}</span><div className="flex gap-2"><Button variant="outline" size="icon" disabled={currentPage<=1} onClick={()=>setPage(p=>p-1)}><ChevronLeft className="w-4 h-4"/></Button><Button variant="outline" size="icon" disabled={currentPage>=totalPages} onClick={()=>setPage(p=>p+1)}><ChevronRight className="w-4 h-4"/></Button></div></div>}</CardContent></Card>}
  </div>;
}
