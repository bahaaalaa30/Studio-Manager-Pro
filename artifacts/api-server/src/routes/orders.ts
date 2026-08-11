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

const router: IRouter = Router();

// Generate sequential order number in format PS-YYYYMMDD-0001
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

// Calculate total from services
function calcTotal(services: Array<{ serviceType: string; quantity: number; unitPrice: number; totalPrice: number }>): number {
  return services.reduce((sum, s) => sum + s.totalPrice, 0);
}

// Service pricing map
const SERVICE_PRICES: Record<string, number> = {
  personal_photos_8pack: 80,
  card_photos_20pack: 150,
  card_photos_1pack: 50,
  urgent_fee: 50,
};

// GET /orders
router.get("/orders", async (req, res): Promise<void> => {
  const parsed = ListOrdersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { status, statuses, date, search } = parsed.data;
  // from/to for range queries (read directly; will be in parsed.data after next codegen)
  const fromDate = typeof req.query.from === "string" ? req.query.from : undefined;
  const toDate   = typeof req.query.to   === "string" ? req.query.to   : undefined;

  let query = db.select().from(ordersTable);
  const conditions = [];

  // Date filtering rules:
  // - Explicit range (from+to): always apply the range — used by Admin table
  // - Status-only query (statuses/status without any date param and no search):
  //   skip date filter entirely so station queues show ALL pending orders
  //   regardless of when they were created
  // - Everything else (plain date, or just no params): default to today
  const hasExplicitRange = !!(fromDate && toDate);
  const hasExplicitDate  = !!date;
  const isStatusOnlyQuery = (status || statuses) && !hasExplicitDate && !hasExplicitRange && !search;

  if (!search && !isStatusOnlyQuery) {
    if (hasExplicitRange) {
      conditions.push(gte(ordersTable.createdAt, new Date(`${fromDate}T00:00:00.000Z`)));
      conditions.push(lte(ordersTable.createdAt, new Date(`${toDate}T23:59:59.999Z`)));
    } else {
      // Single-date mode (default to today) — used by Admin orders table date pickers
      const filterDate = date ?? new Date().toISOString().slice(0, 10);
      conditions.push(gte(ordersTable.createdAt, new Date(`${filterDate}T00:00:00.000Z`)));
      conditions.push(lte(ordersTable.createdAt, new Date(`${filterDate}T23:59:59.999Z`)));
    }
  }

  // Filter by status (single)
  if (status) {
    conditions.push(eq(ordersTable.status, status));
  }

  // Filter by multiple statuses
  if (statuses) {
    const statusList = statuses.split(",").map((s) => s.trim()).filter(Boolean);
    if (statusList.length > 0) {
      const statusConditions = statusList.map((s) => eq(ordersTable.status, s));
      conditions.push(
        statusConditions.length === 1
          ? statusConditions[0]
          : or(...statusConditions)!
      );
    }
  }

  // Search by order number, name, or mobile
  if (search) {
    conditions.push(
      or(
        ilike(ordersTable.orderNumber, `%${search}%`),
        ilike(ordersTable.customerMobile, `%${search}%`),
        ilike(ordersTable.customerName, `%${search}%`)
      )!
    );
  }

  const results = conditions.length > 0
    ? await db.select().from(ordersTable).where(and(...conditions)).orderBy(sql`${ordersTable.createdAt} desc`)
    : await db.select().from(ordersTable).orderBy(sql`${ordersTable.createdAt} desc`);

  res.json(results);
});

// POST /orders
router.post("/orders", async (req, res): Promise<void> => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const data = parsed.data;

  // Fill in unit prices if not provided
  const services = data.services.map((s) => ({
    ...s,
    unitPrice: s.unitPrice ?? SERVICE_PRICES[s.serviceType] ?? 0,
    totalPrice: s.totalPrice ?? (s.unitPrice ?? SERVICE_PRICES[s.serviceType] ?? 0) * s.quantity,
  }));

  const totalAmount = calcTotal(services);
  const paidAmount = data.paidAmount;
  const remainingAmount = Math.max(0, totalAmount - paidAmount);

  const orderNumber = await generateOrderNumber();

  const [order] = await db.insert(ordersTable).values({
    orderNumber,
    customerName: data.customerName ?? null,
    customerMobile: data.customerMobile,
    customerType: data.customerType ?? "walk-in",
    services,
    totalAmount: String(totalAmount),
    paidAmount: String(paidAmount),
    remainingAmount: String(remainingAmount),
    paymentMethod: data.paymentMethod,
    expectedDeliveryTime: data.expectedDeliveryTime ? new Date(data.expectedDeliveryTime) : null,
    status: "WAITING_PHOTOGRAPHY",
    notes: data.notes ?? null,
  }).returning();

  res.status(201).json(order);
});

// GET /orders/:id
router.get("/orders/:id", async (req, res): Promise<void> => {
  const params = GetOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, params.data.id));
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  res.json(order);
});

// PATCH /orders/:id
router.patch("/orders/:id", async (req, res): Promise<void> => {
  const params = UpdateOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const data = parsed.data;
  const updateData: Record<string, unknown> = {};

  if (data.customerName !== undefined) updateData.customerName = data.customerName;
  if (data.customerMobile !== undefined) updateData.customerMobile = data.customerMobile;
  if (data.paymentMethod !== undefined) updateData.paymentMethod = data.paymentMethod;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.expectedDeliveryTime !== undefined) {
    updateData.expectedDeliveryTime = new Date(data.expectedDeliveryTime);
  }

  if (data.services !== undefined) {
    const services = data.services.map((s) => ({
      ...s,
      unitPrice: s.unitPrice ?? SERVICE_PRICES[s.serviceType] ?? 0,
      totalPrice: s.totalPrice ?? (s.unitPrice ?? SERVICE_PRICES[s.serviceType] ?? 0) * s.quantity,
    }));
    const totalAmount = calcTotal(services);
    updateData.services = services;
    updateData.totalAmount = String(totalAmount);

    if (data.paidAmount !== undefined) {
      updateData.paidAmount = String(data.paidAmount);
      updateData.remainingAmount = String(Math.max(0, totalAmount - data.paidAmount));
    } else {
      // Recalculate remaining based on existing paid amount
      const [existing] = await db.select().from(ordersTable).where(eq(ordersTable.id, params.data.id));
      if (existing) {
        const paid = parseFloat(String(existing.paidAmount));
        updateData.remainingAmount = String(Math.max(0, totalAmount - paid));
      }
    }
  } else if (data.paidAmount !== undefined) {
    const [existing] = await db.select().from(ordersTable).where(eq(ordersTable.id, params.data.id));
    if (existing) {
      const total = parseFloat(String(existing.totalAmount));
      updateData.paidAmount = String(data.paidAmount);
      updateData.remainingAmount = String(Math.max(0, total - data.paidAmount));
    }
  }

  if (Object.keys(updateData).length === 0) {
    const [existing] = await db.select().from(ordersTable).where(eq(ordersTable.id, params.data.id));
    if (!existing) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    res.json(existing);
    return;
  }

  const [order] = await db.update(ordersTable).set(updateData).where(eq(ordersTable.id, params.data.id)).returning();
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  res.json(order);
});

// PATCH /orders/:id/status
router.patch("/orders/:id/status", async (req, res): Promise<void> => {
  const params = UpdateOrderStatusParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateOrderStatusBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [order] = await db.update(ordersTable)
    .set({ status: parsed.data.status })
    .where(eq(ordersTable.id, params.data.id))
    .returning();

  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  res.json(order);
});

// PATCH /orders/:id/payment
router.patch("/orders/:id/payment", async (req, res): Promise<void> => {
  const params = CollectPaymentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = CollectPaymentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db.select().from(ordersTable).where(eq(ordersTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  const currentPaid = parseFloat(String(existing.paidAmount));
  const total = parseFloat(String(existing.totalAmount));
  const newPaid = Math.min(total, currentPaid + parsed.data.amount);
  const newRemaining = Math.max(0, total - newPaid);

  const updateData: Record<string, unknown> = {
    paidAmount: String(newPaid),
    remainingAmount: String(newRemaining),
  };
  if (parsed.data.paymentMethod) {
    updateData.paymentMethod = parsed.data.paymentMethod;
  }

  const [order] = await db.update(ordersTable).set(updateData).where(eq(ordersTable.id, params.data.id)).returning();

  res.json(order);
});

export default router;
