import { useEffect, useMemo, useState } from "react";
import { OrderService, PaymentMethod, useCreateOrder, getListOrdersQueryKey, getGetTodayAnalyticsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Copy, Receipt, Package, BriefcaseBusiness } from "lucide-react";

type Service = { id: number; name: string; code: string; price: number | string; is_free: boolean; urgent_allowed: boolean; urgent_price: number | string | null; normal_delivery_days: number; urgent_delivery_days: number | null; description?: string | null };
type PackageItem = { service_id: number; quantity: number; name: string; code: string; price: number | string; urgent_allowed: boolean; urgent_price: number | string | null; normal_delivery_days: number; urgent_delivery_days: number | null };
type Package = { id: number; name: string; code: string; price: number | string; description?: string | null; services: PackageItem[] };
type Selected = { kind: "service" | "package"; id: number; quantity: number; urgent: boolean };

function deliveryDate(createdAt: string, days: number) {
  const date = new Date(createdAt);
  date.setDate(date.getDate() + Math.max(0, days));
  return date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export default function Reception() {
  const queryClient = useQueryClient();
  const createOrder = useCreateOrder();
  const [catalog, setCatalog] = useState<{ services: Service[]; packages: Package[] }>({ services: [], packages: [] });
  const [loading, setLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerMobile, setCustomerMobile] = useState("");
  const [selected, setSelected] = useState<Selected[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [paidAmountStr, setPaidAmountStr] = useState("");
  const [successOrder, setSuccessOrder] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/reception/catalog", { headers: { Accept: "application/json" } })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data?.error || "Failed to load services and packages.");
        return data;
      })
      .then((data) => { if (!cancelled) setCatalog(data); })
      .catch((e) => { if (!cancelled) setCatalogError(e instanceof Error ? e.message : "Failed to load reception catalog."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const servicesById = useMemo(() => new Map(catalog.services.map((s) => [s.id, s])), [catalog.services]);
  const packagesById = useMemo(() => new Map(catalog.packages.map((p) => [p.id, p])), [catalog.packages]);

  const toggle = (kind: "service" | "package", id: number) => {
    setSelected((current) => current.some((x) => x.kind === kind && x.id === id)
      ? current.filter((x) => !(x.kind === kind && x.id === id))
      : [...current, { kind, id, quantity: 1, urgent: false }]);
  };

  const update = (kind: "service" | "package", id: number, patch: Partial<Selected>) => {
    setSelected((current) => current.map((x) => x.kind === kind && x.id === id ? { ...x, ...patch } : x));
  };

  const lines = selected.map((item) => {
    if (item.kind === "service") {
      const service = servicesById.get(item.id)!;
      const unit = item.urgent ? Number(service.urgent_price) : Number(service.price);
      return {
        ...item,
        name: service.name,
        code: service.code,
        unitPrice: unit,
        total: unit * item.quantity,
        deliveryDays: item.urgent ? Number(service.urgent_delivery_days ?? service.normal_delivery_days) : Number(service.normal_delivery_days),
        urgentAllowed: service.urgent_allowed,
      };
    }

    const pkg = packagesById.get(item.id)!;
    const urgentPossible = pkg.services.length > 0 && pkg.services.every((s) => s.urgent_allowed && s.urgent_price !== null);
    const unit = item.urgent
      ? pkg.services.reduce((sum, s) => sum + Number(s.urgent_price ?? s.price) * s.quantity, 0)
      : Number(pkg.price);
    const deliveryDays = item.urgent
      ? Math.max(...pkg.services.map((s) => Number(s.urgent_delivery_days ?? s.normal_delivery_days)), 0)
      : Math.max(...pkg.services.map((s) => Number(s.normal_delivery_days)), 0);

    return {
      ...item,
      name: pkg.name,
      code: `package:${pkg.id}`,
      unitPrice: unit,
      total: unit * item.quantity,
      deliveryDays,
      urgentAllowed: urgentPossible,
    };
  });

  const totalAmount = lines.reduce((sum, line) => sum + line.total, 0);
  const paidAmount = paidAmountStr.trim() === "" ? 0 : Number(paidAmountStr);
  const paidValid = paidAmountStr.trim() === "" || (Number.isFinite(paidAmount) && paidAmount >= 0 && paidAmount <= totalAmount);
  const remaining = paidValid ? Math.max(0, totalAmount - paidAmount) : totalAmount;
  const deliveryDays = lines.length ? Math.max(...lines.map((x) => x.deliveryDays), 0) : 0;

  const submit = (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!customerName.trim() || !customerMobile.trim() || !lines.length || !paidValid) return;

    const services: OrderService[] = lines.map((line) => ({
      serviceType: line.code,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      totalPrice: line.total,
      ...(line.urgent ? { urgent: true } : {}),
    } as OrderService));

    createOrder.mutate({
      data: {
        customerName: customerName.trim(),
        customerMobile: customerMobile.trim(),
        customerType: "walk-in",
        services,
        paymentMethod,
        paidAmount,
      },
    }, {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetTodayAnalyticsQueryKey() });
        setSuccessOrder(data);
      },
    });
  };

  const reset = () => {
    setCustomerName("");
    setCustomerMobile("");
    setSelected([]);
    setPaymentMethod("cash");
    setPaidAmountStr("");
    setSuccessOrder(null);
  };

  if (successOrder) return (
    <div className="print-receipt p-8 max-w-2xl mx-auto w-full">
      <Card className="border-2 border-primary">
        <CardHeader className="text-center bg-primary/5 pb-8 border-b">
          <div className="mx-auto w-16 h-16 bg-primary rounded-full flex items-center justify-center mb-4"><CheckCircle2 className="w-8 h-8 text-primary-foreground" /></div>
          <CardTitle className="text-3xl font-mono">{successOrder.orderNumber}</CardTitle>
          <p className="text-muted-foreground mt-2">Order successfully created</p>
        </CardHeader>
        <CardContent className="p-8 space-y-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-muted-foreground block">Customer</span><span className="font-medium">{successOrder.customerName || "Walk-in"}</span></div>
            <div><span className="text-muted-foreground block">Mobile</span><span className="font-medium">{successOrder.customerMobile}</span></div>
            <div><span className="text-muted-foreground block">Order Date & Time</span><span className="font-medium">{new Date(successOrder.createdAt).toLocaleString("en-GB")}</span></div>
            <div><span className="text-muted-foreground block">Payment</span><span className="font-medium uppercase">{successOrder.paymentMethod.replace(/_/g, " ")}</span></div>
            <div className="col-span-2"><span className="text-muted-foreground block">Delivery Date</span><span className="font-medium">{deliveryDate(successOrder.createdAt, deliveryDays)}</span></div>
          </div>
          <div className="border-t border-b py-4 space-y-2">{successOrder.services.map((svc: any, i: number) => <div key={i} className="flex justify-between text-sm"><span>{svc.quantity}x {svc.serviceName || svc.serviceType}</span><span className="font-mono">{formatCurrency(Number(svc.totalPrice))}</span></div>)}</div>
          <div className="space-y-1">
            <div className="flex justify-between text-sm text-muted-foreground"><span>Total</span><span className="font-mono">{formatCurrency(Number(successOrder.totalAmount))}</span></div>
            <div className="flex justify-between text-sm text-muted-foreground"><span>Paid</span><span className="font-mono">{formatCurrency(Number(successOrder.paidAmount))}</span></div>
            <div className="flex justify-between font-bold text-lg pt-2 border-t"><span>Remaining</span><span className="font-mono text-primary">{formatCurrency(Number(successOrder.remainingAmount))}</span></div>
          </div>
          <div className="no-print bg-muted p-4 rounded-lg flex items-center justify-between"><div><span className="text-xs text-muted-foreground block mb-1">Tracking Link</span><span className="font-mono text-sm font-medium">{window.location.origin}/track?order={successOrder.orderNumber}</span></div><Button variant="outline" size="icon"><Copy className="w-4 h-4" /></Button></div>
        </CardContent>
        <CardFooter className="no-print bg-muted/50 p-6 flex gap-4"><Button className="flex-1" onClick={() => window.print()}><Receipt className="w-4 h-4 mr-2" />Print Receipt</Button><Button variant="outline" className="flex-1" onClick={reset}>New Order</Button></CardFooter>
      </Card>
    </div>
  );

  const cardGridClass = "grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3";
  const compactCardClass = (active: boolean) => `p-3 border rounded-lg transition-all min-h-[112px] ${active ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "hover:border-primary/50 hover:bg-muted/30"}`;

  return (
    <div className="p-8 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-8">
        <div><h2 className="text-2xl font-bold tracking-tight">New Order</h2><p className="text-muted-foreground">Select configured services or packages from Admin Settings.</p></div>
        <form onSubmit={submit} className="space-y-8">
          <Card>
            <CardHeader><CardTitle className="text-lg">Customer Information</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label htmlFor="customerMobile">Mobile Number *</Label><Input id="customerMobile" value={customerMobile} onChange={(e) => setCustomerMobile(e.target.value)} placeholder="01xxxxxxxxx" required /></div>
              <div className="space-y-2"><Label htmlFor="customerName">Name *</Label><Input id="customerName" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Customer name" required /></div>
            </CardContent>
          </Card>

          {catalogError && <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-destructive">{catalogError}</div>}

          <Card>
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><BriefcaseBusiness className="w-5 h-5" />Services</CardTitle></CardHeader>
            <CardContent>
              {loading ? <p className="text-muted-foreground">Loading services...</p> : (
                <div className={cardGridClass}>
                  {catalog.services.map((service) => {
                    const item = selected.find((x) => x.kind === "service" && x.id === service.id);
                    return (
                      <div key={service.id} className={compactCardClass(!!item)}>
                        <div className="flex h-full flex-col justify-between gap-2">
                          <button type="button" className="text-left min-w-0 flex-1" onClick={() => toggle("service", service.id)}>
                            <div className="font-medium truncate" title={service.name}>{service.name}</div>
                            <div className="text-sm font-semibold mt-1">{formatCurrency(Number(service.price))}</div>
                            <div className="text-xs text-muted-foreground mt-1">{service.normal_delivery_days} day(s)</div>
                          </button>
                          {item && <div className="flex items-center justify-between gap-1"><Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => update("service", service.id, { quantity: Math.max(1, item.quantity - 1) })}>-</Button><span className="font-mono text-sm w-5 text-center">{item.quantity}</span><Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => update("service", service.id, { quantity: item.quantity + 1 })}>+</Button></div>}
                          {item && service.urgent_allowed && <label className="flex items-center gap-1.5 text-[11px] text-destructive cursor-pointer"><input type="checkbox" checked={item.urgent} onChange={(e) => update("service", service.id, { urgent: e.target.checked })} />Urgent <Badge variant="destructive" className="text-[9px] px-1.5 py-0">FAST</Badge></label>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Package className="w-5 h-5" />Packages</CardTitle></CardHeader>
            <CardContent>
              {loading ? <p className="text-muted-foreground">Loading packages...</p> : (
                <div className={cardGridClass}>
                  {catalog.packages.map((pkg) => {
                    const item = selected.find((x) => x.kind === "package" && x.id === pkg.id);
                    const urgentPossible = pkg.services.length > 0 && pkg.services.every((s) => s.urgent_allowed && s.urgent_price !== null);
                    return (
                      <div key={pkg.id} className={compactCardClass(!!item)}>
                        <div className="flex h-full flex-col justify-between gap-2">
                          <button type="button" className="text-left min-w-0 flex-1" onClick={() => toggle("package", pkg.id)}>
                            <div className="font-medium truncate" title={pkg.name}>{pkg.name}</div>
                            <div className="text-sm font-semibold mt-1">{formatCurrency(Number(pkg.price))}</div>
                            <div className="text-xs text-muted-foreground mt-1">{pkg.services.length} service(s)</div>
                          </button>
                          {pkg.services.length > 0 && <div className="text-[10px] text-muted-foreground truncate" title={pkg.services.map((s) => `${s.quantity}× ${s.name}`).join(" • ")}>{pkg.services.map((s) => `${s.quantity}× ${s.name}`).join(" • ")}</div>}
                          {item && <div className="flex items-center justify-between gap-1"><Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => update("package", pkg.id, { quantity: Math.max(1, item.quantity - 1) })}>-</Button><span className="font-mono text-sm w-5 text-center">{item.quantity}</span><Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => update("package", pkg.id, { quantity: item.quantity + 1 })}>+</Button></div>}
                          {item && urgentPossible && <label className="flex items-center gap-1.5 text-[11px] text-destructive cursor-pointer"><input type="checkbox" checked={item.urgent} onChange={(e) => update("package", pkg.id, { urgent: e.target.checked })} />Urgent <Badge variant="destructive" className="text-[9px] px-1.5 py-0">FAST</Badge></label>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </form>
      </div>

      <div>
        <Card className="sticky top-8 shadow-xl border-primary/20">
          <CardHeader className="bg-muted/50 pb-4"><CardTitle className="text-lg">Order Summary</CardTitle></CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="space-y-3">{lines.map((line) => <div key={`${line.kind}-${line.id}`} className="flex justify-between text-sm"><span>{line.quantity}x {line.name}{line.urgent ? " • Urgent" : ""}</span><span className="font-mono">{formatCurrency(line.total)}</span></div>)}{!lines.length && <div className="text-sm text-muted-foreground text-center py-4">No services selected</div>}</div>
            <div className="border-t pt-4 space-y-4">
              <div className="flex justify-between text-lg font-bold"><span>Total</span><span className="font-mono">{formatCurrency(totalAmount)}</span></div>
              <div className="space-y-2"><Label>Payment Method</Label><select className="w-full h-10 rounded-md border bg-background px-3" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}><option value="cash">Cash</option><option value="visa">Visa / Card</option><option value="instapay">InstaPay</option><option value="vodafone_cash">Vodafone Cash</option></select></div>
              <div className="space-y-2"><Label>Paid Amount</Label><Input type="number" min="0" max={totalAmount} value={paidAmountStr} onChange={(e) => setPaidAmountStr(e.target.value)} placeholder="0" />{!paidValid && <p className="text-xs text-destructive">Paid amount must be between 0 and {formatCurrency(totalAmount)}.</p>}</div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Remaining</span><span className="font-mono font-bold">{formatCurrency(remaining)}</span></div>
              <div className="text-sm text-muted-foreground">Expected delivery: {deliveryDays} day(s)</div>
            </div>
            <Button className="w-full" size="lg" disabled={!lines.length || !customerName.trim() || !customerMobile.trim() || !paidValid || createOrder.isPending} onClick={() => submit()}>{createOrder.isPending ? "Creating Order..." : "Create Order"}</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
