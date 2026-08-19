import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Order } from "@workspace/api-client-react"
import { formatCurrency, getStatusColor } from "@/lib/format"
import { User, Phone } from "lucide-react"

export function OrderCard({
  order,
  actions,
  hidePrices = false,
}: {
  order: Order
  actions?: React.ReactNode
  hidePrices?: boolean
}) {
  return (
    <Card className="hover-elevate transition-all border-l-4" style={{ borderLeftColor: `var(--${getStatusColor(order.status)})` }}>
      <CardHeader className="p-4 pb-2 flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-lg font-mono">{order.orderNumber}</CardTitle>
          <div className="flex items-center text-sm text-muted-foreground mt-1 gap-4">
            <span className="flex items-center gap-1"><User className="w-3 h-3" /> {order.customerName || "Walk-in"}</span>
            <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {order.customerMobile}</span>
          </div>
        </div>
        <Badge variant={getStatusColor(order.status) as any}>{order.status.replace(/_/g, " ")}</Badge>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        <div className="my-3 space-y-1">
          {order.services.map((svc: any, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span>
                {svc.quantity}x {svc.serviceName || svc.serviceType.replace(/_/g, " ")}
              </span>
              {!hidePrices && <span className="font-mono">{formatCurrency(svc.totalPrice)}</span>}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-3 border-t">
          {!hidePrices && (
            <div className="text-sm font-medium">
              Total: {formatCurrency(order.totalAmount)}
            </div>
          )}
          {actions && (
            <div className={`flex gap-2 ${hidePrices ? "w-full" : ""}`}>
              {actions}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
