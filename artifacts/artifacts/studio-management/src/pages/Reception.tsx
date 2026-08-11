import { useState } from "react";
import { OrderService, PaymentMethod, useCreateOrder, getListOrdersQueryKey, getGetTodayAnalyticsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Copy, Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";

function calcDeliveryDate(services: any[], createdAt: string): string {
  const hasPersonal = services.some(s => s.serviceType === "personal_photos_8pack");
  const hasCard     = services.some(s => s.serviceType === "card_photos_1pack");
  const isUrgent    = services.some(s => s.serviceType === "urgent_fee");

  let days = 0;
  if (hasPersonal && hasCard) {
    days = isUrgent ? 1 : 2;
  } else if (hasPersonal) {
    days = isUrgent ? 0 : 1;
  } else if (hasCard) {
    days = isUrgent ? 1 : 2;
  }

  const date = new Date(createdAt);
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export default function Reception() {
  const queryClient = useQueryClient();
  const createOrder = useCreateOrder();

  const [customerName, setCustomerName] = useState("");
  const [customerMobile, setCustomerMobile] = useState("");
  const [personalPhotosQty, setPersonalPhotosQty] = useState(0);
  const [cardPhotos1Qty, setCardPhotos1Qty] = useState(0);
  const [urgent, setUrgent] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [paidAmountStr, setPaidAmountStr] = useState("");
  const [successOrder, setSuccessOrder] = useState<any>(null);

  const personalPrice = 80;

  const card1Price = 50;
  const urgentPrice = 50;

  const totalPersonal = (personalPhotosQty / 8) * personalPrice;

  const totalCard1 = cardPhotos1Qty * card1Price;
  const totalUrgent = urgent ? urgentPrice : 0;
  const totalAmount = totalPersonal + totalCard1 + totalUrgent;

  const hasPhotoService = personalPhotosQty > 0 || cardPhotos1Qty > 0;

  const paidAmount = parseFloat(paidAmountStr) || 0;
  const remainingAmount = Math.max(0, totalAmount - paidAmount);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (totalAmount === 0) return;
    if (!customerMobile) return;
    if (!customerName) return;

    const services: OrderService[] = [];
    if (personalPhotosQty > 0) {
      services.push({
        serviceType: "personal_photos_8pack",
        quantity: personalPhotosQty / 8,
        unitPrice: personalPrice,
        totalPrice: totalPersonal,
      });
    }
    if (cardPhotos1Qty > 0) {
      services.push({
        serviceType: "card_photos_1pack",
        quantity: cardPhotos1Qty,
        unitPrice: card1Price,
        totalPrice: totalCard1,
      });
    }
    if (urgent) {
      services.push({
        serviceType: "urgent_fee",
        quantity: 1,
        unitPrice: urgentPrice,
        totalPrice: urgentPrice,
      });
    }

    createOrder.mutate(
      {
        data: {
          customerName,
          customerMobile,
          customerType: "walk-in",
          services,
          paymentMethod,
          paidAmount: Math.min(paidAmount, totalAmount),
        },
      },
      {
        onSuccess: (data) => {
          queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetTodayAnalyticsQueryKey() });
          setSuccessOrder(data);
        },
      }
    );
  };

  const resetForm = () => {
    setCustomerName("");
    setCustomerMobile("");
    setPersonalPhotosQty(0);

    setCardPhotos1Qty(0);
    setUrgent(false);
    setPaymentMethod("cash");
    setPaidAmountStr("");
    setSuccessOrder(null);
  };

  if (successOrder) {
    return (
      <div className="print-receipt p-8 max-w-2xl mx-auto w-full">
        <Card className="border-2 border-primary">
          <CardHeader className="text-center bg-primary/5 pb-8 border-b">
            <div className="mx-auto w-16 h-16 bg-primary rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-primary-foreground" />
            </div>
            <CardTitle className="text-3xl font-mono">{successOrder.orderNumber}</CardTitle>
            <p className="text-muted-foreground mt-2">Order successfully created</p>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground block">Customer</span>
                <span className="font-medium">{successOrder.customerName || "Walk-in"}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Mobile</span>
                <span className="font-medium">{successOrder.customerMobile}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Order Date & Time</span>
                <span className="font-medium">
                  {new Date(successOrder.createdAt).toLocaleString("en-GB", {
                    day: "numeric", month: "short", year: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  })}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">Payment</span>
                <span className="font-medium uppercase">{successOrder.paymentMethod.replace(/_/g, " ")}</span>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground block">Delivery Date</span>
                <span className="font-medium">{calcDeliveryDate(successOrder.services, successOrder.createdAt)}</span>
              </div>
            </div>

            <div className="border-t border-b py-4 space-y-2">
              {successOrder.services.map((svc: any, i: number) => (
                <div key={i} className="flex justify-between text-sm">
                  <span>
                    {svc.quantity}x {svc.serviceType.replace(/_/g, " ")}
                  </span>
                  <span className="font-mono">{formatCurrency(svc.totalPrice)}</span>
                </div>
              ))}
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Total</span>
                <span className="font-mono">{formatCurrency(successOrder.totalAmount)}</span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Paid</span>
                <span className="font-mono">{formatCurrency(successOrder.paidAmount)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg pt-2 border-t">
                <span>Remaining</span>
                <span className="font-mono text-primary">{formatCurrency(successOrder.remainingAmount)}</span>
              </div>
            </div>

            <div className="no-print bg-muted p-4 rounded-lg flex items-center justify-between">
              <div>
                <span className="text-xs text-muted-foreground block mb-1">Tracking Link</span>
                <span className="font-mono text-sm font-medium">
                  {window.location.origin}/track?order={successOrder.orderNumber}
                </span>
              </div>
              <Button variant="outline" size="icon">
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
          <CardFooter className="no-print bg-muted/50 p-6 flex gap-4">
            <Button className="flex-1" onClick={() => window.print()}>
              <Receipt className="w-4 h-4 mr-2" />
              Print Receipt
            </Button>
            <Button variant="outline" className="flex-1" onClick={resetForm}>
              New Order
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-8">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">New Order</h2>
          <p className="text-muted-foreground">Intake customer details and select services.</p>
        </div>

        <form id="order-form" onSubmit={handleSubmit} className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Customer Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customerMobile">Mobile Number *</Label>
                <Input
                  id="customerMobile"
                  placeholder="01xxxxxxxxx"
                  value={customerMobile}
                  onChange={(e) => setCustomerMobile(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customerName">Name *</Label>
                <Input
                  id="customerName"
                  placeholder="e.g. Ahmed Ali"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  required
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Services</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Personal Photos — counter */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <div className="font-medium">Personal Photos</div>
                  <div className="text-sm text-muted-foreground">8-pack • {formatCurrency(personalPrice)}</div>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setPersonalPhotosQty(Math.max(0, personalPhotosQty - 8))}
                  >
                    -
                  </Button>
                  <span className="font-mono w-8 text-center">{personalPhotosQty}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setPersonalPhotosQty(personalPhotosQty + 8)}
                  >
                    +
                  </Button>
                </div>
              </div>

              {/* Card Photos 1-pack — counter */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <div className="font-medium">Card Photos</div>
                  <div className="text-sm text-muted-foreground">1-pack • {formatCurrency(card1Price)}</div>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setCardPhotos1Qty(Math.max(0, cardPhotos1Qty - 1))}
                  >
                    -
                  </Button>
                  <span className="font-mono w-8 text-center">{cardPhotos1Qty}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setCardPhotos1Qty(cardPhotos1Qty + 1)}
                  >
                    +
                  </Button>
                </div>
              </div>

              {/* Urgent Processing — only active when a photo service is selected */}
              <div
                className={`flex items-center justify-between p-4 border rounded-lg transition-colors ${
                  !hasPhotoService
                    ? "opacity-40 cursor-not-allowed bg-muted/30"
                    : urgent
                    ? "border-destructive bg-destructive/5 cursor-pointer"
                    : "hover:border-destructive/50 cursor-pointer"
                }`}
                onClick={() => hasPhotoService && setUrgent(!urgent)}
              >
                <div>
                  <div className="font-medium flex items-center gap-2">
                    Urgent Processing
                    <Badge variant="destructive" className="uppercase text-[10px]">
                      Fast Track
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {hasPhotoService ? `Jump the queue • +${formatCurrency(urgentPrice)}` : "Select a photo service first"}
                  </div>
                </div>
                <div
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                    urgent && hasPhotoService ? "border-destructive bg-destructive" : "border-muted-foreground"
                  }`}
                >
                  {urgent && hasPhotoService && <CheckCircle2 className="w-4 h-4 text-destructive-foreground" />}
                </div>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>

      <div>
        <Card className="sticky top-8 shadow-xl border-primary/20">
          <CardHeader className="bg-muted/50 pb-4">
            <CardTitle className="text-lg">Order Summary</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="space-y-3">
              {personalPhotosQty > 0 && (
                <div className="flex justify-between text-sm">
                  <span>{personalPhotosQty / 8}x Personal (8-pack)</span>
                  <span className="font-mono">{formatCurrency(totalPersonal)}</span>
                </div>
              )}
              {cardPhotos1Qty > 0 && (
                <div className="flex justify-between text-sm">
                  <span>{cardPhotos1Qty}x Card Photos (1-pack)</span>
                  <span className="font-mono">{formatCurrency(totalCard1)}</span>
                </div>
              )}
              {urgent && (
                <div className="flex justify-between text-sm text-destructive">
                  <span>1x Urgent Fee</span>
                  <span className="font-mono">{formatCurrency(urgentPrice)}</span>
                </div>
              )}
              {totalAmount === 0 && (
                <div className="text-sm text-muted-foreground text-center py-4">No services selected</div>
              )}
            </div>

            <div className="border-t pt-4 space-y-4">
              <div className="flex justify-between items-center text-lg font-bold">
                <span>Total</span>
                <span className="font-mono">{formatCurrency(totalAmount)}</span>
              </div>

              <div className="space-y-3">
                <Label>Payment Method</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(["cash", "visa", "instapay", "vodafone_cash"] as PaymentMethod[]).map((method) => (
                    <div
                      key={method}
                      onClick={() => setPaymentMethod(method)}
                      className={`text-center py-2 px-3 text-xs font-medium uppercase rounded border cursor-pointer transition-colors ${
                        paymentMethod === method ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"
                      }`}
                    >
                      {method.replace("_", " ")}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Amount Paid</Label>
                <div className="relative">
                  <Input
                    type="number"
                    min="0"
                    max={totalAmount}
                    step="0.01"
                    placeholder="0.00"
                    className="font-mono pr-12 text-lg h-12"
                    value={paidAmountStr}
                    onChange={(e) => setPaidAmountStr(e.target.value)}
                  />
                  <span className="absolute right-4 top-3.5 text-muted-foreground font-mono text-sm">EGP</span>
                </div>
              </div>

              <div className="flex justify-between items-center text-sm font-medium pt-2">
                <span className="text-muted-foreground">Remaining Balance</span>
                <span className="font-mono text-destructive">{formatCurrency(remainingAmount)}</span>
              </div>
            </div>
          </CardContent>
          <CardFooter className="pt-0">
            <Button
              type="submit"
              form="order-form"
              className="w-full h-12 text-lg font-bold"
              disabled={totalAmount === 0 || !customerMobile || !customerName || createOrder.isPending}
            >
              {createOrder.isPending ? "Creating..." : "Create Order"}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
