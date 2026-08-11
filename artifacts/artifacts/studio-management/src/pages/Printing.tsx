import { useListOrders, useUpdateOrderStatus, getListOrdersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { OrderCard } from "@/components/shared/OrderCard";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export default function Printing() {
  const queryClient = useQueryClient();
  const { data: orders = [], isLoading } = useListOrders(
    { statuses: "WAITING_PRINT,PRINTING" },
    { query: { refetchInterval: 15000 } }
  );

  const updateStatus = useUpdateOrderStatus();

  const handleStatusChange = (id: number, status: "PRINTING" | "READY_FOR_DELIVERY") => {
    updateStatus.mutate({ id, data: { status } }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() }),
    });
  };

  const waitingOrders    = orders.filter(o => o.status === "WAITING_PRINT");
  const inProgressOrders = orders.filter(o => o.status === "PRINTING");

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full flex flex-col gap-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
          <Printer className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
          Printing Station
        </h2>
        <p className="text-muted-foreground text-sm mt-1">Print outputs and final assembly.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between border-b pb-2">
            <h3 className="font-semibold">Waiting ({waitingOrders.length})</h3>
          </div>
          <div className="space-y-3">
            {waitingOrders.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                actions={
                  <Button size="sm" className="w-full"
                    onClick={() => handleStatusChange(order.id, "PRINTING")}
                    disabled={updateStatus.isPending}
                  >
                    Start Printing
                  </Button>
                }
              />
            ))}
            {waitingOrders.length === 0 && !isLoading && (
              <div className="text-center py-10 text-muted-foreground border-2 border-dashed rounded-lg text-sm">
                No orders waiting.
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between border-b pb-2">
            <h3 className="font-semibold">In Progress ({inProgressOrders.length})</h3>
          </div>
          <div className="space-y-3">
            {inProgressOrders.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                actions={
                  <Button size="sm" className="w-full bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => handleStatusChange(order.id, "READY_FOR_DELIVERY")}
                    disabled={updateStatus.isPending}
                  >
                    Finish Printing
                  </Button>
                }
              />
            ))}
            {inProgressOrders.length === 0 && !isLoading && (
              <div className="text-center py-10 text-muted-foreground border-2 border-dashed rounded-lg text-sm">
                No active printing.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
