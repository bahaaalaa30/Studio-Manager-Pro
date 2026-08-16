import { Router, type IRouter } from "express";
import { eq, and, gte, lte, or, ilike, sql } from "drizzle-orm";
import { db, ordersTable } from "@workspace/db";
import {
  ListOrdersQueryParams,
  CreateOrderBody,
  GetOrderParams,
  UpdateOrderParams,
  UpdateOrderBody,
  UpdateOrderStatusParams,
  UpdateOrderStatusBody,
  CollectPaymentParams,
  CollectPaymentBody,
} from "@workspace/api-zod";
import {
  calculateExpectedDeliveryTime,
  validatePaidAmount,
} from "../lib/order-calculations.js";

const router: IRouter = Router();

async function generateOrderNumber(): Promise<string> {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `PS-${date}-`;
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(ordersTable)
    .where(ilike(ordersTable.orderNumber, `${prefix}%`));
  const seq = (Number(count) + 1).toString().padStart(4, "0");
  return `${prefix}${seq}`;
}

function calcTotal(services: Array<{ serviceType: string; quantity: number; unitPrice: number; totalPrice: number }>): number {
  return services.reduce((sum, s) => sum + s.totalPrice, 0);
}

const SERVICE_PRICES: Record<string, number> = {
  personal_photos_8pack: 80,
  card_photos_20pack: 150,
  card_photos_1pack: 50,
  urgent_fee: 50,
};

function withExpectedDeliveryTime<T extends { createdAt: Date; expectedDeliveryTime: Date | null; services: unknown }>(order: T): T {
  if (order.expectedDeliveryTime) return order;
  const services = Array.isArray(order.services)
    ? order.services.filter((service): service is { serviceType: string } =>
        typeof service === "object" && service !== null && "serviceType" in service &&
        typeof (service as { serviceType?: unknown }).serviceType === "string")
    : [];
  return { ...order, expectedDeliveryTime: calculateExpectedDeliveryTime(services, order.createdAt) };
}

// GET /orders
router.get("/orders", async (req, res): Promise<void> => {
  const parsed = ListOrdersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { status, statuses, date, search } = parsed.data;
  const fromDate = typeof req.query.from === "string" ? req.query.from : undefined;
  const toDate = typeof req.query.to === "string" ? req.query.to : undefined;
  const orderNumber = typeof req.query.orderNumber === "string" ? req.query.orderNumber.trim() : undefined;
  const customerName = typeof req.query.customerName === "string" ? req.query.customerName.trim() : undefined;
  const customerMobile = typeof req.query.customerMobile === "string" ? req.query.customerMobile.trim() : undefined;
  const service = typeof req.query.service === "string" ? req.query.service.trim() : undefined;
  const paymentStatus = typeof req.query.paymentStatus === "string" ? req.query.paymentStatus.trim().toLowerCase() : undefined;

  const hasExplicitRange = !!(fromDate && toDate);
  const hasExplicitDate = !!date;
  const hasCriteria = !!(search || status || statuses || hasExplicitDate || hasExplicitRange || orderNumber || customerName || customerMobile || service || paymentStatus);
  const conditions = [];

  // No criteria means no implicit "today" filter. Return all orders for existing operational callers.
  if (hasExplicitRange) {
    conditions.push(gte(ordersTable.createdAt, new Date(`${fromDate}T00:00:00.000Z`)));
    conditions.push(lte(ordersTable.createdAt, new Date(`${toDate}T23:59:59.999Z`)));
  } else if (hasExplicitDate) {
    conditions.push(gte(ordersTable.createdAt, new Date(`${date}T00:00:00.000Z`)));
    conditions.push(lte(ordersTable.createdAt, new Date(`${date}T23:59:59.999Z`)));
  }

  if (status) conditions.push(eq(ordersTable.status, status));
  if (statuses) {
    const statusList = statuses.split(",").map((s) => s.trim()).filter(Boolean);
    if (statusList.length > 0) {
      const statusConditions = statusList.map((s) => eq(ordersTable.status, s));
      conditions.push(statusConditions.length === 1 ? statusConditions[0] : or(...statusConditions)!);
    }
  }

  if (search) {
    conditions.push(or(
      ilike(ordersTable.orderNumber, `%${search}%`),
      ilike(ordersTable.customerMobile, `%${search}%`),
      ilike(ordersTable.customerName, `%${search}%`),
    )!);
  }
  if (orderNumber) conditions.push(ilike(ordersTable.orderNumber, `%${orderNumber}%`));
  if (customerName) conditions.push(ilike(ordersTable.customerName, `%${customerName}%`));
  if (customerMobile) conditions.push(ilike(ordersTable.customerMobile, `%${customerMobile}%`));

  if (service) {
    conditions.push(sql<boolean>`EXISTS (
      SELECT 1 FROM jsonb_array_elements(${ordersTable.services}) AS service
      WHERE service->>'serviceType' = ${service}
    )`);
  }

  if (paymentStatus === "paid") {
    conditions.push(sql<boolean>`${ordersTable.paidAmount} >= ${ordersTable.totalAmount}`);
  } else if (paymentStatus === "unpaid") {
    conditions.push(sql<boolean>`${ordersTable.paidAmount} <= 0`);
  } else if (paymentStatus === "partial" || paymentStatus === "partially_paid") {
    conditions.push(sql<boolean>`${ordersTable.paidAmount} > 0 AND ${ordersTable.paidAmount} < ${ordersTable.totalAmount}`);
  }

  const results = conditions.length > 0
    ? await db.select().from(ordersTable).where(and(...conditions)).orderBy(sql`${ordersTable.createdAt} desc`)
    : await db.select().from(ordersTable).orderBy(sql`${ordersTable.createdAt} desc`);

  res.json(results.map(withExpectedDeliveryTime));
});

// POST /orders
router.post("/orders", async (req, res): Promise<void> => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const data = parsed.data;
  const services = data.services.map((s) => ({
    ...s,
    unitPrice: s.unitPrice ?? SERVICE_PRICES[s.serviceType] ?? 0,
    totalPrice: s.totalPrice ?? (s.unitPrice ?? SERVICE_PRICES[s.serviceType] ?? 0) * s.quantity,
  }));
  const totalAmount = calcTotal(services);
  const paidAmount = data.paidAmount;
  const paymentValidationError = validatePaidAmount(paidAmount, totalAmount);
  if (paymentValidationError) { res.status(400).json({ error: paymentValidationError }); return; }
  const remainingAmount = totalAmount - paidAmount;
  const orderNumber = await generateOrderNumber();
  const createdAt = new Date();
  const expectedDeliveryTime = data.expectedDeliveryTime ? new Date(data.expectedDeliveryTime) : calculateExpectedDeliveryTime(services, createdAt);
  const [order] = await db.insert(ordersTable).values({ orderNumber, customerName: data.customerName ?? null, customerMobile: data.customerMobile, customerType: data.customerType ?? "walk-in", services, totalAmount: String(totalAmount), paidAmount: String(paidAmount), remainingAmount: String(remainingAmount), paymentMethod: data.paymentMethod, expectedDeliveryTime, status: "WAITING_PHOTOGRAPHY", notes: data.notes ?? null }).returning();
  res.status(201).json(order);
});

router.get("/orders/:id", async (req, res): Promise<void> => {
  const params = GetOrderParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, params.data.id));
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  res.json(withExpectedDeliveryTime(order));
});

router.patch("/orders/:id", async (req, res): Promise<void> => {
  const params = UpdateOrderParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateOrderBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const data = parsed.data;
  const updateData: Record<string, unknown> = {};
  if (data.customerName !== undefined) updateData.customerName = data.customerName;
  if (data.customerMobile !== undefined) updateData.customerMobile = data.customerMobile;
  if (data.paymentMethod !== undefined) updateData.paymentMethod = data.paymentMethod;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.expectedDeliveryTime !== undefined) updateData.expectedDeliveryTime = new Date(data.expectedDeliveryTime);
  if (data.services !== undefined) {
    const services = data.services.map((s) => ({ ...s, unitPrice: s.unitPrice ?? SERVICE_PRICES[s.serviceType] ?? 0, totalPrice: s.totalPrice ?? (s.unitPrice ?? SERVICE_PRICES[s.serviceType] ?? 0) * s.quantity }));
    const totalAmount = calcTotal(services);
    updateData.services = services;
    updateData.totalAmount = String(totalAmount);
    if (data.paidAmount !== undefined) {
      const paymentValidationError = validatePaidAmount(data.paidAmount, totalAmount);
      if (paymentValidationError) { res.status(400).json({ error: paymentValidationError }); return; }
      updateData.paidAmount = String(data.paidAmount); updateData.remainingAmount = String(totalAmount - data.paidAmount);
    } else {
      const [existing] = await db.select().from(ordersTable).where(eq(ordersTable.id, params.data.id));
      if (existing) { const paid = parseFloat(String(existing.paidAmount)); const paymentValidationError = validatePaidAmount(paid, totalAmount); if (paymentValidationError) { res.status(400).json({ error: paymentValidationError }); return; } updateData.remainingAmount = String(totalAmount - paid); }
    }
  } else if (data.paidAmount !== undefined) {
    const [existing] = await db.select().from(ordersTable).where(eq(ordersTable.id, params.data.id));
    if (existing) { const total = parseFloat(String(existing.totalAmount)); const paymentValidationError = validatePaidAmount(data.paidAmount, total); if (paymentValidationError) { res.status(400).json({ error: paymentValidationError }); return; } updateData.paidAmount = String(data.paidAmount); updateData.remainingAmount = String(total - data.paidAmount); }
  }
  if (Object.keys(updateData).length === 0) {
    const [existing] = await db.select().from(ordersTable).where(eq(ordersTable.id, params.data.id));
    if (!existing) { res.status(404).json({ error: "Order not found" }); return; }
    res.json(withExpectedDeliveryTime(existing)); return;
  }
  const [order] = await db.update(ordersTable).set(updateData).where(eq(ordersTable.id, params.data.id)).returning();
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  res.json(withExpectedDeliveryTime(order));
});

router.patch("/orders/:id/status", async (req, res): Promise<void> => {
  const params = UpdateOrderStatusParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateOrderStatusBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [order] = await db.update(ordersTable).set({ status: parsed.data.status }).where(eq(ordersTable.id, params.data.id)).returning();
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  res.json(withExpectedDeliveryTime(order));
});

router.patch("/orders/:id/payment", async (req, res): Promise<void> => {
  const params = CollectPaymentParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const normalizedBody = { ...req.body, amount: typeof req.body?.amount === "string" ? Number(req.body.amount) : req.body?.amount };
  const parsed = CollectPaymentBody.safeParse(normalizedBody);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(ordersTable).where(eq(ordersTable.id, params.data.id));
  if (!existing) { res.status(404).json({ error: "Order not found" }); return; }
  const currentPaid = parseFloat(String(existing.paidAmount));
  const total = parseFloat(String(existing.totalAmount));
  const newPaid = currentPaid + parsed.data.amount;
  const paymentValidationError = validatePaidAmount(newPaid, total);
  if (paymentValidationError) { res.status(400).json({ error: paymentValidationError }); return; }
  const updateData: Record<string, unknown> = { paidAmount: String(newPaid), remainingAmount: String(total - newPaid) };
  if (parsed.data.paymentMethod) updateData.paymentMethod = parsed.data.paymentMethod;
  const [order] = await db.update(ordersTable).set(updateData).where(eq(ordersTable.id, params.data.id)).returning();
  res.json(withExpectedDeliveryTime(order));
});

export default router;
