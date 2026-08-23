import { useState } from "react";
import { useListOrders, useUpdateOrderStatus, useCollectPayment, getListOrdersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { OrderCard } from "@/components/shared/OrderCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PackageCheck, Search, DollarSign } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";

type PaymentMethod = "cash" | "visa" | "instapay" | "vodafone_cash";
const PAYMENT_METHODS: Array<{ value: PaymentMethod; label: string }> = [
  { value: "cash", label: "Cash" },
  { value: "visa", label: "Visa" },
  { value: "instapay", label: "Instapay" },
  { value: "vodafone_cash", label: "Vodafone Cash" },
];

export default function Delivery() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [collectingOrderId, setCollectingOrderId] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");

  const { data: orders = [], isLoading } = useListOrders(
    debouncedSearch ? { search: debouncedSearch } : { statuses: "READY_FOR_DELIVERY" },
    { query: { queryKey: getListOrdersQueryKey(), enabled: true } }
  );
  const updateStatus = useUpdateOrderStatus();
  const collectPayment = useCollectPayment();

  const handleDeliver = (id: number) => {
    updateStatus.mutate({ id, data: { status: "DELIVERED" } }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() }),
    });
  };

  const openPaymentPicker = (id: number) => {
    setCollectingOrderId(id);
    setPaymentMethod("cash");
  };

  const handlePayment = (id: number, amount: number) => {
    collectPayment.mutate({ id, data: { amount, paymentMethod } }, {
      onSuccess: () => {
        updateStatus.mutate({ id, data: { status: "DELIVERED" } }, {
          onSuccess: () => {
            setCollectingOrderId(null);
            queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
            queryClient.invalidateQueries({ queryKey: ["getAnalyticsRange"] });
          },
        });
      },
    });
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full flex flex-col gap-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
          <PackageCheck className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
          Delivery Station
        </h2>
        <p className="text-muted-foreground text-sm mt-1">Deliver ready orders and collect pending balances.</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by order number or mobile..."
          className="pl-10 h-10"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            const v = e.target.value;
            setTimeout(() => setDebouncedSearch(v), 300);
          }}
        />
      </div>

      <div className="space-y-4">
        {orders.length === 0 && !isLoading && (
          <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg text-sm">
            {debouncedSearch ? "No matching orders found." : "No orders ready for delivery."}
          </div>
        )}

        {orders.map((order) => {
          const needsPayment = order.remainingAmount > 0;
          const isReady = order.status === "READY_FOR_DELIVERY";
          const isDelivered = order.status === "DELIVERED";
          const isCollecting = collectingOrderId === order.id;

          return (
            <Card key={order.id} className="overflow-hidden">
              <CardContent className="p-0 flex flex-col lg:flex-row">
                <div className="flex-1 p-0"><OrderCard order={order} /></div>
                <div className="bg-muted/30 p-4 sm:p-6 lg:w-72 flex flex-col justify-center border-t lg:border-t-0 lg:border-l space-y-4">
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Total</span><span>{formatCurrency(order.totalAmount)}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Paid</span><span>{formatCurrency(order.paidAmount)}</span></div>
                    <div className={`flex justify-between font-bold pt-2 border-t ${needsPayment ? "text-destructive" : "text-success"}`}><span>Remaining</span><span>{formatCurrency(order.remainingAmount)}</span></div>
                  </div>

                  {isReady && needsPayment && !isCollecting && (
                    <Button className="w-full bg-green-600 hover:bg-green-700 text-white" onClick={() => openPaymentPicker(order.id)} disabled={collectPayment.isPending || updateStatus.isPending}>
                      <DollarSign className="w-4 h-4 mr-2" /> Collect Remaining
                    </Button>
                  )}

                  {isReady && needsPayment && isCollecting && (
                    <div className="space-y-3 pt-2">
                      <label className="text-sm font-medium">Payment Method</label>
                      <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)} className="w-full h-10 rounded-md border bg-background px-3 text-sm">
                        {PAYMENT_METHODS.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}
                      </select>
                      <div className="flex gap-2">
                        <Button variant="outline" className="flex-1" onClick={() => setCollectingOrderId(null)} disabled={collectPayment.isPending}>Cancel</Button>
                        <Button className="flex-1 bg-green-600 hover:bg-green-700 text-white" onClick={() => handlePayment(order.id, order.remainingAmount)} disabled={collectPayment.isPending || updateStatus.isPending}>Collect</Button>
                      </div>
                    </div>
                  )}

                  {isReady && !needsPayment && (
                    <Button className="w-full bg-green-600 hover:bg-green-700 text-white" onClick={() => handleDeliver(order.id)} disabled={updateStatus.isPending}>
                      <PackageCheck className="w-4 h-4 mr-2" /> Deliver & Complete
                    </Button>
                  )}

                  {isDelivered && <div className="text-center p-3 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 rounded-md font-medium text-sm flex items-center justify-center gap-2"><PackageCheck className="w-4 h-4" /> Delivered</div>}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
