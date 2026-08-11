import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Camera, MonitorPlay, Printer, PackageCheck, CheckCircle2 } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { useListOrders, useUpdateOrderStatus, getListOrdersQueryKey } from "@workspace/api-client-react";

const STAGES = [
  { id: "CREATED",   label: "Created",        statuses: ["NEW", "WAITING_PHOTOGRAPHY"], icon: CheckCircle2 },
  { id: "SHOOTING",  label: "Shooting",        statuses: ["IN_PHOTOGRAPHY", "WAITING_EDITING"], icon: Camera },
  { id: "EDITING",   label: "Editing",         statuses: ["EDITING", "WAITING_PRINT"], icon: MonitorPlay },
  { id: "PRINTING",  label: "Printing",        statuses: ["PRINTING"], icon: Printer },
  { id: "READY",     label: "Ready",           statuses: ["READY_FOR_DELIVERY"], icon: PackageCheck },
  { id: "DELIVERED", label: "Delivered",       statuses: ["DELIVERED"], icon: CheckCircle2 },
];

export default function Track() {
  const [searchTerm, setSearchTerm] = useState("");
  const [searched, setSearched] = useState(false);

  useState(() => {
    const params = new URLSearchParams(window.location.search);
    const orderParam = params.get("order");
    if (orderParam) {
      setSearchTerm(orderParam);
      setSearched(true);
    }
  });

  const { data: orders = [], isLoading } = useListOrders(
    { search: searchTerm },
    {  query: {
        queryKey: getListOrdersQueryKey(),

        enabled: searched && searchTerm.length > 3,
      }, }
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) setSearched(true);
  };

  const order = orders[0];

  const getStageIndex = (status: string) =>
    STAGES.findIndex(stage => stage.statuses.includes(status));

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-start sm:justify-center p-4 py-8 sm:py-12">
      <div className="w-full max-w-2xl space-y-8 sm:space-y-12">

        {/* Header */}
        <div className="text-center space-y-3">
          <div className="w-14 h-14 sm:w-16 sm:h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto shadow-lg">
            <Camera className="w-7 h-7 sm:w-8 sm:h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Track Your Order</h1>
          <p className="text-muted-foreground text-sm max-w-sm mx-auto">
            Enter your order number or phone number to check your photo status.
          </p>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="relative max-w-xl mx-auto shadow-lg rounded-full">
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="PS-20260719-0001 or 01xxxxxxxxx"
            className="h-12 sm:h-14 pl-5 pr-28 sm:pr-32 rounded-full text-base sm:text-lg border-primary/20 focus-visible:border-primary bg-card"
          />
          <Button type="submit" className="absolute right-1 top-1 bottom-1 rounded-full px-4 sm:px-6">
            <Search className="w-4 h-4 sm:w-5 sm:h-5" />
          </Button>
        </form>

        {searched && isLoading && (
          <div className="text-center text-muted-foreground animate-pulse text-sm">Looking up order...</div>
        )}

        {searched && !isLoading && !order && searchTerm.length > 3 && (
          <div className="text-center text-muted-foreground p-6 bg-muted/30 rounded-2xl border border-dashed text-sm">
            No order found matching "{searchTerm}". Please check the number and try again.
          </div>
        )}

        {order && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-500">
            <Card className="border-primary/20 shadow-xl overflow-hidden">
              <div className="bg-primary/5 p-4 sm:p-6 border-b text-center">
                <div className="text-xs font-semibold tracking-wider text-muted-foreground uppercase mb-1">Order Number</div>
                <div className="text-xl sm:text-2xl font-mono font-bold">{order.orderNumber}</div>
              </div>

              <CardContent className="p-4 sm:p-8">
                {/* Progress stepper — horizontal with overflow on tiny screens */}
                <div className="mb-10 mt-2 overflow-x-auto">
                  <div className="relative min-w-[340px] px-2">
                    {/* Track line */}
                    <div className="absolute top-5 left-8 right-8 h-1 bg-muted" />
                    <div
                      className="absolute top-5 left-8 h-1 bg-primary transition-all duration-1000 ease-out"
                      style={{
                        width: `calc(${(Math.max(0, getStageIndex(order.status)) / (STAGES.length - 1)) * 100}% * ((100% - 4rem) / 100%))`,
                        maxWidth: "calc(100% - 4rem)",
                      }}
                    />

                    <div className="relative flex justify-between">
                      {STAGES.map((stage, i) => {
                        const currentIndex = getStageIndex(order.status);
                        const isCompleted = i < currentIndex;
                        const isCurrent   = i === currentIndex;
                        const isFuture    = i > currentIndex;

                        const colorClass = isCompleted
                          ? "bg-primary text-primary-foreground border-primary"
                          : isCurrent
                          ? "bg-background text-primary border-primary border-2 ring-4 ring-primary/20 scale-110"
                          : "bg-muted text-muted-foreground border-muted";

                        return (
                          <div key={stage.id} className="flex flex-col items-center w-10">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 shadow-sm ${colorClass}`}>
                              <stage.icon className="w-4 h-4" />
                            </div>
                            <div className={`text-[10px] font-semibold text-center mt-2 w-14 -ml-2 leading-tight ${isCurrent ? "text-primary" : isFuture ? "text-muted-foreground/50" : "text-foreground"}`}>
                              {stage.label}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {order.status === "READY_FOR_DELIVERY" && (
                  <div className="bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-400 p-3 sm:p-4 rounded-lg text-center mb-6 flex items-center justify-center gap-2 font-medium text-sm">
                    <PackageCheck className="w-4 h-4 sm:w-5 sm:h-5" />
                    Your photos are ready for pickup!
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-dashed">
                  <div>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Order Details</h3>
                    <div className="space-y-2">
                      {order.services.map((svc: any, i: number) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span>{svc.quantity}x {svc.serviceType.replace(/_/g, " ")}</span>
                          <span className="font-mono">{formatCurrency(svc.totalPrice)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-muted/30 p-4 rounded-xl space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total Amount</span>
                      <span className="font-mono">{formatCurrency(order.totalAmount)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Amount Paid</span>
                      <span className="font-mono">{formatCurrency(order.paidAmount)}</span>
                    </div>
                    <div className="flex justify-between font-bold pt-2 border-t text-sm sm:text-base">
                      <span>Remaining</span>
                      <span className="font-mono text-primary">{formatCurrency(order.remainingAmount)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
