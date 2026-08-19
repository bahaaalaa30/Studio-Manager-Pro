import { Router, type IRouter } from "express";
import { gte, lte, and, sql } from "drizzle-orm";
import { db, ordersTable } from "@workspace/db";

const router: IRouter = Router();

const IN_PROGRESS_STATUSES = ["WAITING_PHOTOGRAPHY", "IN_PHOTOGRAPHY", "WAITING_EDITING", "EDITING", "WAITING_PRINT", "PRINTING"];

router.get("/analytics/today", async (req, res): Promise<void> => {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const startOfDay = new Date(`${todayStr}T00:00:00.000Z`);
  const endOfDay = new Date(`${todayStr}T23:59:59.999Z`);
  const todayCondition = and(gte(ordersTable.createdAt, startOfDay), lte(ordersTable.createdAt, endOfDay));
  const todayOrders = await db.select().from(ordersTable).where(todayCondition);
  const allOrders = await db.select().from(ordersTable);
  const totalOrdersToday = todayOrders.length;
  const totalRevenueToday = todayOrders.reduce((sum, o) => sum + parseFloat(String(o.paidAmount)), 0);
  const pendingPickups = allOrders.filter((o) => o.status === "READY_FOR_DELIVERY").length;
  const ordersInProgress = allOrders.filter((o) => IN_PROGRESS_STATUSES.includes(o.status)).length;
  const statusCounts: Record<string, number> = {};
  for (const order of todayOrders) statusCounts[order.status] = (statusCounts[order.status] ?? 0) + 1;
  const statusBreakdown = Object.entries(statusCounts).map(([status, count]) => ({ status, count }));
  const paymentRevenue: Record<string, number> = {};
  for (const order of todayOrders) { const method = order.paymentMethod; paymentRevenue[method] = (paymentRevenue[method] ?? 0) + parseFloat(String(order.paidAmount)); }
  const paymentBreakdown = Object.entries(paymentRevenue).map(([paymentMethod, revenue]) => ({ paymentMethod, revenue }));
  res.json({ totalOrdersToday, totalRevenueToday, pendingPickups, ordersInProgress, statusBreakdown, paymentBreakdown });
});

router.get("/analytics/range", async (req, res): Promise<void> => {
  const today = new Date().toISOString().slice(0, 10);
  const fromStr = typeof req.query.from === "string" ? req.query.from : today;
  const toStr = typeof req.query.to === "string" ? req.query.to : today;
  const start = new Date(`${fromStr}T00:00:00.000Z`);
  const end = new Date(`${toStr}T23:59:59.999Z`);

  const [rangeOrders, allOrders, serviceRows] = await Promise.all([
    db.select().from(ordersTable).where(and(gte(ordersTable.createdAt, start), lte(ordersTable.createdAt, end))).orderBy(ordersTable.createdAt),
    db.select({ status: ordersTable.status }).from(ordersTable),
    db.execute(sql.raw(`SELECT code, name FROM smp_services`)),
  ]);

  const serviceNames = new Map<string, string>();
  for (const row of serviceRows.rows as Array<{ code: string; name: string }>) serviceNames.set(String(row.code), String(row.name));

  const totalOrders = rangeOrders.length;
  const totalRevenue = rangeOrders.reduce((s, o) => s + parseFloat(String(o.totalAmount)), 0);
  const collectedRevenue = rangeOrders.reduce((s, o) => s + parseFloat(String(o.paidAmount)), 0);
  const outstandingRevenue = rangeOrders.reduce((s, o) => s + parseFloat(String(o.remainingAmount)), 0);
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const deliveredOrders = rangeOrders.filter((o) => o.status === "DELIVERED").length;
  const urgentOrders = rangeOrders.filter((o) => (o.services as Array<{ serviceType: string }>).some((s) => s.serviceType === "urgent_fee")).length;
  const pendingPickups = allOrders.filter((o) => o.status === "READY_FOR_DELIVERY").length;
  const ordersInProgress = allOrders.filter((o) => IN_PROGRESS_STATUSES.includes(o.status)).length;

  const dailyMap: Record<string, { revenue: number; orders: number }> = {};
  for (const o of rangeOrders) { const d = (o.createdAt as Date).toISOString().slice(0, 10); if (!dailyMap[d]) dailyMap[d] = { revenue: 0, orders: 0 }; dailyMap[d].revenue += parseFloat(String(o.paidAmount)); dailyMap[d].orders += 1; }
  const dailyRevenue = Object.entries(dailyMap).map(([date, v]) => ({ date, ...v })).sort((a, b) => a.date.localeCompare(b.date));

  const statusMap: Record<string, number> = {};
  for (const o of rangeOrders) statusMap[o.status] = (statusMap[o.status] ?? 0) + 1;
  const statusBreakdown = Object.entries(statusMap).map(([status, count]) => ({ status, count }));

  const paymentMap: Record<string, { revenue: number; count: number }> = {};
  for (const o of rangeOrders) { const m = o.paymentMethod; if (!paymentMap[m]) paymentMap[m] = { revenue: 0, count: 0 }; paymentMap[m].revenue += parseFloat(String(o.paidAmount)); paymentMap[m].count += 1; }
  const paymentBreakdown = Object.entries(paymentMap).map(([paymentMethod, v]) => ({ paymentMethod, ...v }));

  const serviceMap: Record<string, { quantity: number; revenue: number; code: string }> = {};
  for (const o of rangeOrders) {
    for (const s of o.services as Array<{ serviceType: string; quantity: number; totalPrice: number }>) {
      const code = String(s.serviceType ?? "");
      if (code === "urgent_fee") continue;
      if (!serviceMap[code]) serviceMap[code] = { quantity: 0, revenue: 0, code };
      serviceMap[code].quantity += Number(s.quantity) || 0;
      serviceMap[code].revenue += Number(s.totalPrice) || 0;
    }
  }
  const serviceBreakdown = Object.values(serviceMap).map((v) => ({
    serviceType: serviceNames.get(v.code) ?? v.code.replace(/_/g, " "),
    serviceCode: v.code,
    quantity: v.quantity,
    revenue: v.revenue,
  }));

  const hourMap: Record<number, number> = {};
  for (const o of rangeOrders) { const h = (o.createdAt as Date).getHours(); hourMap[h] = (hourMap[h] ?? 0) + 1; }
  const hourlyDistribution = Object.entries(hourMap).map(([hour, count]) => ({ hour: parseInt(hour), count })).sort((a, b) => a.hour - b.hour);

  res.json({ from: fromStr, to: toStr, totalOrders, totalRevenue, collectedRevenue, outstandingRevenue, avgOrderValue, urgentOrders, deliveredOrders, pendingPickups, ordersInProgress, dailyRevenue, statusBreakdown, paymentBreakdown, serviceBreakdown, hourlyDistribution });
});

export default router;
