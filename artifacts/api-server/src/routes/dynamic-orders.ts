import { Router } from "express";
import { db, ordersTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { CreateOrderBody, PaymentMethod } from "@workspace/api-zod";

const router = Router();
const quote = (value: unknown) => value === null || value === undefined ? "NULL" : typeof value === "number" ? String(value) : typeof value === "boolean" ? (value ? "TRUE" : "FALSE") : `'${String(value).replace(/'/g, "''")}'`;

async function ensurePackageItemsTable() {
  await db.execute(sql.raw(`CREATE TABLE IF NOT EXISTS smp_package_items (id SERIAL PRIMARY KEY, package_id INTEGER NOT NULL REFERENCES smp_packages(id) ON DELETE CASCADE, service_id INTEGER NOT NULL REFERENCES smp_services(id) ON DELETE RESTRICT, quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE (package_id, service_id))`));
}

async function generateOrderNumber() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `PS-${date}-`;
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(ordersTable).where(sql`${ordersTable.orderNumber} ILIKE ${prefix + "%"}`);
  return `${prefix}${(Number(count) + 1).toString().padStart(4, "0")}`;
}

function addDays(date: Date, days: number) { const result = new Date(date); result.setDate(result.getDate() + Math.max(0, days)); return result; }

router.post("/orders", async (req, res): Promise<void> => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const data = parsed.data;
  await ensurePackageItemsTable();
  try {
    const codes = data.services.map((s) => String(s.serviceType));
    const servicesResult = codes.length ? await db.execute(sql.raw(`SELECT id, name, code, price, is_free, urgent_allowed, urgent_price, normal_delivery_days, urgent_delivery_days FROM smp_services WHERE status = 'ACTIVE' AND code IN (${codes.map(quote).join(",")})`)) : { rows: [] } as any;
    const servicesByCode = new Map(servicesResult.rows.map((row: any) => [String(row.code), row]));
    const packageIds = codes.filter((code) => code.startsWith("package:")).map((code) => Number(code.slice(8))).filter((id) => Number.isInteger(id) && id > 0);
    const packagesResult = packageIds.length ? await db.execute(sql.raw(`SELECT id, name, code, price FROM smp_packages WHERE status = 'ACTIVE' AND id IN (${packageIds.join(",")})`)) : { rows: [] } as any;
    const packagesById = new Map(packagesResult.rows.map((row: any) => [Number(row.id), row]));
    const packageItemsResult = packageIds.length ? await db.execute(sql.raw(`SELECT pi.package_id, pi.quantity, s.id service_id, s.name, s.code, s.price, s.urgent_allowed, s.urgent_price, s.normal_delivery_days, s.urgent_delivery_days FROM smp_package_items pi JOIN smp_services s ON s.id = pi.service_id WHERE pi.package_id IN (${packageIds.join(",")}) AND s.status = 'ACTIVE'`)) : { rows: [] } as any;
    const itemsByPackage = new Map<number, any[]>();
    for (const row of packageItemsResult.rows) { const list = itemsByPackage.get(Number(row.package_id)) ?? []; list.push(row); itemsByPackage.set(Number(row.package_id), list); }

    const snapshot: any[] = [];
    let totalAmount = 0;
    let maxDeliveryDays = 0;
    for (const selected of data.services) {
      const quantity = Number(selected.quantity);
      if (!Number.isInteger(quantity) || quantity <= 0) { res.status(400).json({ error: "Service quantity must be a positive whole number." }); return; }
      const code = String(selected.serviceType);
      if (code.startsWith("package:")) {
        const packageId = Number(code.slice(8)); const pack = packagesById.get(packageId); const items = itemsByPackage.get(packageId) ?? [];
        if (!pack || !items.length) { res.status(400).json({ error: `Package ${packageId} is not configured with active services.` }); return; }
        let urgentPackagePrice = Number(pack.price); let normalDays = 0; let urgentDays = 0; let urgentPossible = true;
        for (const item of items) { normalDays = Math.max(normalDays, Number(item.normal_delivery_days) || 0); if (item.urgent_allowed && item.urgent_price !== null) urgentDays = Math.max(urgentDays, Number(item.urgent_delivery_days) || 0); else urgentPossible = false; }
        const urgent = Boolean((selected as any).urgent);
        if (urgent) { if (!urgentPossible) { res.status(400).json({ error: `${pack.name} cannot be processed urgently because one of its services does not allow urgent processing.` }); return; } urgentPackagePrice = items.reduce((sum, item) => sum + Number(item.urgent_price ?? item.price) * Number(item.quantity), 0); }
        const unitPrice = urgent ? urgentPackagePrice : Number(pack.price);
        totalAmount += unitPrice * quantity;
        maxDeliveryDays = Math.max(maxDeliveryDays, urgent ? urgentDays : normalDays);
        snapshot.push({ serviceType: `package:${pack.id}`, serviceName: pack.name, quantity, unitPrice, totalPrice: unitPrice * quantity, urgent, packageId: pack.id, packageCode: pack.code, packageItems: items.map((item) => ({ serviceId: item.service_id, serviceName: item.name, serviceCode: item.code, quantity: Number(item.quantity) })) });
      } else {
        const service = servicesByCode.get(code); if (!service) { res.status(400).json({ error: `Service '${code}' is not active or does not exist.` }); return; }
        const urgent = Boolean((selected as any).urgent);
        if (urgent && !service.urgent_allowed) { res.status(400).json({ error: `${service.name} does not allow urgent processing.` }); return; }
        const unitPrice = urgent ? Number(service.urgent_price) : Number(service.price);
        if (!Number.isFinite(unitPrice) || unitPrice < 0) { res.status(400).json({ error: `${service.name} has an invalid price configuration.` }); return; }
        totalAmount += unitPrice * quantity;
        maxDeliveryDays = Math.max(maxDeliveryDays, urgent ? Number(service.urgent_delivery_days) : Number(service.normal_delivery_days));
        snapshot.push({ serviceType: service.code, serviceName: service.name, quantity, unitPrice, totalPrice: unitPrice * quantity, urgent, serviceId: Number(service.id) });
      }
    }
    const paidAmount = Number(data.paidAmount);
    if (!Number.isFinite(paidAmount) || paidAmount < 0 || paidAmount > totalAmount) { res.status(400).json({ error: `Paid amount must be between 0 and ${totalAmount}.` }); return; }
    const createdAt = new Date();
    const orderNumber = await generateOrderNumber();
    const expectedDeliveryTime = data.expectedDeliveryTime ? new Date(data.expectedDeliveryTime) : addDays(createdAt, maxDeliveryDays);
    const [order] = await db.insert(ordersTable).values({ orderNumber, customerName: data.customerName ?? null, customerMobile: data.customerMobile, customerType: data.customerType ?? "walk-in", services: snapshot, totalAmount: String(totalAmount), paidAmount: String(paidAmount), remainingAmount: String(totalAmount - paidAmount), paymentMethod: data.paymentMethod as PaymentMethod, expectedDeliveryTime, status: "WAITING_PHOTOGRAPHY", notes: data.notes ?? null }).returning();
    res.status(201).json(order);
  } catch (error) { req.log.error({ err: error }, "Dynamic order creation failed"); res.status(500).json({ error: "Failed to create order.", details: error instanceof Error ? error.message : String(error) }); }
});

export default router;
