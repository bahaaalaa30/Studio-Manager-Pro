import { Router, type IRouter } from "express";
import { gte, lte, and, sql } from "drizzle-orm";
import { db, ordersTable, paymentTransactionsTable } from "@workspace/db";

const router: IRouter = Router();
const IN_PROGRESS_STATUSES = ["WAITING_PHOTOGRAPHY", "IN_PHOTOGRAPHY", "WAITING_EDITING", "EDITING", "WAITING_PRINT", "PRINTING"];
type OrderServiceLine = { serviceType?: string; quantity?: number; unitPrice?: number; totalPrice?: number; urgent?: boolean };
type PaymentRow = { orderId: number; amount: string | number; paymentMethod: string; type: string; createdAt: Date };

async function getIncomeTransactions(rangeOrders: Array<{ id: number; paidAmount: unknown; paymentMethod: string; createdAt: Date }>, start: Date, end: Date): Promise<PaymentRow[]> {
  const rows = await db.select().from(paymentTransactionsTable).where(and(gte(paymentTransactionsTable.createdAt, start), lte(paymentTransactionsTable.createdAt, end)));
  const typedRows = rows as PaymentRow[];
  const transactionOrderIds = new Set(typedRows.map((r) => r.orderId));
  for (const order of rangeOrders) {
    if (!transactionOrderIds.has(order.id) && parseFloat(String(order.paidAmount)) > 0 && order.createdAt >= start && order.createdAt <= end) {
      typedRows.push({ orderId: order.id, amount: String(order.paidAmount), paymentMethod: order.paymentMethod, type: "LEGACY_INITIAL", createdAt: order.createdAt });
    }
  }
  return typedRows;
}

router.get("/analytics/today", async (req, res): Promise<void> => {
  const todayStr = new Date().toISOString().slice(0, 10); const startOfDay = new Date(`${todayStr}T00:00:00.000Z`); const endOfDay = new Date(`${todayStr}T23:59:59.999Z`);
  const [todayOrders, allOrders] = await Promise.all([db.select().from(ordersTable).where(and(gte(ordersTable.createdAt, startOfDay), lte(ordersTable.createdAt, endOfDay))), db.select().from(ordersTable)]);
  const income = await getIncomeTransactions(todayOrders, startOfDay, endOfDay);
  const totalOrdersToday = todayOrders.length; const totalRevenueToday = income.reduce((sum, p) => sum + parseFloat(String(p.amount)), 0);
  const pendingPickups = allOrders.filter((o) => o.status === "READY_FOR_DELIVERY").length; const ordersInProgress = allOrders.filter((o) => IN_PROGRESS_STATUSES.includes(o.status)).length;
  const statusCounts: Record<string, number> = {}; const paymentMap: Record<string, { revenue: number; count: number }> = {};
  for (const order of todayOrders) statusCounts[order.status] = (statusCounts[order.status] ?? 0) + 1;
  for (const p of income) { if (!paymentMap[p.paymentMethod]) paymentMap[p.paymentMethod] = { revenue: 0, count: 0 }; paymentMap[p.paymentMethod].revenue += parseFloat(String(p.amount)); paymentMap[p.paymentMethod].count += 1; }
  const paymentTotal = Object.values(paymentMap).reduce((sum, item) => sum + item.revenue, 0);
  res.json({ totalOrdersToday, totalRevenueToday, pendingPickups, ordersInProgress, statusBreakdown: Object.entries(statusCounts).map(([status, count]) => ({ status, count })), paymentBreakdown: Object.entries(paymentMap).map(([paymentMethod, v]) => ({ paymentMethod, revenue: v.revenue, count: v.count, percentage: paymentTotal > 0 ? (v.revenue / paymentTotal) * 100 : 0 })).sort((a, b) => b.revenue - a.revenue) });
});

router.get("/analytics/range", async (req, res): Promise<void> => {
  const today = new Date().toISOString().slice(0, 10); const fromStr = typeof req.query.from === "string" ? req.query.from : today; const toStr = typeof req.query.to === "string" ? req.query.to : today;
  const start = new Date(`${fromStr}T00:00:00.000Z`); const end = new Date(`${toStr}T23:59:59.999Z`);
  const [rangeOrders, allOrders, serviceRows] = await Promise.all([
    db.select().from(ordersTable).where(and(gte(ordersTable.createdAt, start), lte(ordersTable.createdAt, end))).orderBy(ordersTable.createdAt),
    db.select({ status: ordersTable.status }).from(ordersTable),
    db.execute(sql.raw(`SELECT code, name FROM smp_services`)),
  ]);
  const income = await getIncomeTransactions(rangeOrders, start, end);
  const serviceNames = new Map<string, string>(); for (const row of serviceRows.rows as Array<{ code: string; name: string }>) serviceNames.set(String(row.code), String(row.name));
  const totalOrders = rangeOrders.length; const totalRevenue = rangeOrders.reduce((s, o) => s + parseFloat(String(o.totalAmount)), 0); const collectedRevenue = income.reduce((s, p) => s + parseFloat(String(p.amount)), 0); const outstandingRevenue = rangeOrders.reduce((s, o) => s + parseFloat(String(o.remainingAmount)), 0); const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const deliveredOrders = rangeOrders.filter((o) => o.status === "DELIVERED").length; const urgentOrders = rangeOrders.filter((o) => (o.services as OrderServiceLine[]).some((s) => s.serviceType === "urgent_fee" || s.urgent === true)).length; const pendingPickups = allOrders.filter((o) => o.status === "READY_FOR_DELIVERY").length; const ordersInProgress = allOrders.filter((o) => IN_PROGRESS_STATUSES.includes(o.status)).length;
  const dailyMap: Record<string, { revenue: number; orders: number }> = {}; const statusMap: Record<string, number> = {};
  for (const o of rangeOrders) { const d = (o.createdAt as Date).toISOString().slice(0, 10); if (!dailyMap[d]) dailyMap[d] = { revenue: 0, orders: 0 }; dailyMap[d].orders += 1; statusMap[o.status] = (statusMap[o.status] ?? 0) + 1; }
  for (const p of income) { const d = p.createdAt.toISOString().slice(0, 10); if (!dailyMap[d]) dailyMap[d] = { revenue: 0, orders: 0 }; dailyMap[d].revenue += parseFloat(String(p.amount)); }
  const dailyRevenue = Object.entries(dailyMap).map(([date, v]) => ({ date, ...v })).sort((a, b) => a.date.localeCompare(b.date));
  const statusBreakdown = Object.entries(statusMap).map(([status, count]) => ({ status, count }));
  const paymentMap: Record<string, { revenue: number; count: number }> = {};
  for (const p of income) { if (!paymentMap[p.paymentMethod]) paymentMap[p.paymentMethod] = { revenue: 0, count: 0 }; paymentMap[p.paymentMethod].revenue += parseFloat(String(p.amount)); paymentMap[p.paymentMethod].count += 1; }
  const paymentTotal = Object.values(paymentMap).reduce((sum, item) => sum + item.revenue, 0);
  const paymentBreakdown = Object.entries(paymentMap).map(([paymentMethod, v]) => ({ paymentMethod, revenue: v.revenue, count: v.count, percentage: paymentTotal > 0 ? (v.revenue / paymentTotal) * 100 : 0 })).sort((a, b) => b.revenue - a.revenue);
  const serviceMap: Record<string, { quantity: number; revenue: number; code: string }> = {};
  for (const o of rangeOrders) for (const s of o.services as OrderServiceLine[]) { const code = String(s.serviceType ?? ""); if (code === "urgent_fee") continue; if (!serviceMap[code]) serviceMap[code] = { quantity: 0, revenue: 0, code }; serviceMap[code].quantity += Number(s.quantity) || 0; serviceMap[code].revenue += Number(s.totalPrice) || 0; }
  const serviceBreakdown = Object.values(serviceMap).map((v) => ({ serviceType: serviceNames.get(v.code) ?? v.code.replace(/_/g, " "), serviceCode: v.code, quantity: v.quantity, revenue: v.revenue }));
  const hourMap: Record<number, number> = {}; for (const o of rangeOrders) { const h = (o.createdAt as Date).getHours(); hourMap[h] = (hourMap[h] ?? 0) + 1; }
  const hourlyDistribution = Object.entries(hourMap).map(([hour, count]) => ({ hour: parseInt(hour), count })).sort((a, b) => a.hour - b.hour);
  const orders = rangeOrders.map((order) => ({ id: order.id, orderNumber: order.orderNumber, customerName: order.customerName, customerMobile: order.customerMobile, customerType: order.customerType, services: (order.services as OrderServiceLine[]).map((service) => ({ ...service, serviceName: serviceNames.get(String(service.serviceType ?? "")) ?? String(service.serviceType ?? "").replace(/_/g, " ") })), totalAmount: Number(order.totalAmount), paidAmount: Number(order.paidAmount), remainingAmount: Number(order.remainingAmount), paymentMethod: order.paymentMethod, expectedDeliveryTime: order.expectedDeliveryTime, status: order.status, createdAt: order.createdAt, updatedAt: order.updatedAt }));
  res.json({ from: fromStr, to: toStr, totalOrders, totalRevenue, collectedRevenue, outstandingRevenue, avgOrderValue, urgentOrders, deliveredOrders, pendingPickups, ordersInProgress, dailyRevenue, statusBreakdown, paymentBreakdown, serviceBreakdown, hourlyDistribution, orders });
});
export default router;
