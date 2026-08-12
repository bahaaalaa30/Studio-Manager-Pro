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

// Validate a payment against the order total.
// Negative values are handled by the request schema; this helper also protects
// every route from accepting a paid amount greater than the order total.
function validatePaidAmount(paidAmount: number, totalAmount: number): string | null {
  if (!Number.isFinite(paidAmount)) {
    return "Paid amount must be a valid number";
  }
  if (paidAmount < 0) {
    return "Paid amount cannot be negative";
  }
  if (paidAmount > totalAmount) {
    return `Paid amount cannot exceed order total of ${totalAmount.toFixed(2)}`;
  }
  return null;
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
  const toDate   = typeof req.query.to   === "string" ? req.query.to   : undefined;

  let query = db.select().from(ordersTable);
  const conditions = [];

  const hasExplicitRange = !!(fromDate && toDate);
  const hasExplicitDate  = !!date;
  const isStatusOnlyQuery = (status || statuses) && !hasExplicitDate && !hasExplicitRange && !search;

  if (!search && !isStatusOnlyQuery) {
    if (hasExplicitRange) {
      conditions.push(gte(ordersTable.createdAt, new Date(`${fromDate}T00:00:00.000Z`)));
      conditions.push(lte(ordersTable.createdAt, new Date(`${toDate}T23:59:59.999Z`)));
    } else {
      const filterDate = date ?? new Date().toISOString().slice(0, 10);
      conditions.push(gte(ordersTable.createdAt, new Date(`${filterDate}T00:00:00.000Z`)));
      conditions.push(lte(ordersTable.createdAt, new Date(`${filterDate}T23:59:59.999Z`)));
    }
  }

  if (status) {
    conditions.push(eq(ordersTable.status, status));
  }

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

  const services = data.services.map((s) => ({
    ...s,
    unitPrice: s.unitPrice ?? SERVICE_PRICES[s.serviceType] ?? 0,
    totalPrice: s.totalPrice ?? (s.unitPrice ?? SERVICE_PRICES[s.serviceType] ?? 0) * s.quantity,
  }));

  const totalAmount = calcTotal(services);
  const paidAmount = data.paidAmount;
  const paymentValidationError = validatePaidAmount(paidAmount, totalAmount);
  if (paymentValidationError) {
    res.status(400).json({ error: paymentValidationError });
    return;
  }

  const remainingAmount = totalAmount - paidAmount;

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
      const paymentValidationError = validatePaidAmount(data.paidAmount, totalAmount);
      if (paymentValidationError) {
        res.status(400).json({ error: paymentValidationError });
        return;
      }
      updateData.paidAmount = String(data.paidAmount);
      updateData.remainingAmount = String(totalAmount - data.paidAmount);
    } else {
      const [existing] = await db.select().from(ordersTable).where(eq(ordersTable.id, params.data.id));
      if (existing) {
        const paid = parseFloat(String(existing.paidAmount));
        const paymentValidationError = validatePaidAmount(paid, totalAmount);
        if (paymentValidationError) {
          res.status(400).json({ error: paymentValidationError });
          return;
        }
        updateData.remainingAmount = String(totalAmount - paid);
      }
    }
  } else if (data.paidAmount !== undefined) {
    const [existing] = await db.select().from(ordersTable).where(eq(ordersTable.id, params.data.id));
    if (existing) {
      const total = parseFloat(String(existing.totalAmount));
      const paymentValidationError = validatePaidAmount(data.paidAmount, total);
      if (paymentValidationError) {
        res.status(400).json({ error: paymentValidationError });
        return;
      }
      updateData.paidAmount = String(data.paidAmount);
      updateData.remainingAmount = String(total - data.paidAmount);
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

  // Browser form controls commonly send numeric values as strings (e.g. "80.00").
  // Normalize the amount before Zod validation so the API accepts both JSON numbers and form-style strings.
  const normalizedBody = {
    ...req.body,
    amount: typeof req.body?.amount === "string" ? Number(req.body.amount) : req.body?.amount,
  };
  const parsed = CollectPaymentBody.safeParse(normalizedBody);
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
  const newPaid = currentPaid + parsed.data.amount;
  const paymentValidationError = validatePaidAmount(newPaid, total);
  if (paymentValidationError) {
    res.status(400).json({ error: paymentValidationError });
    return;
  }
  const newRemaining = total - newPaid;

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
