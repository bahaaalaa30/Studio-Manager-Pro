import { pgTable, serial, text, numeric, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderNumber: text("order_number").notNull().unique(),
  customerName: text("customer_name"),
  customerMobile: text("customer_mobile").notNull(),
  customerType: text("customer_type").notNull().default("walk-in"),
  services: jsonb("services").notNull().$type<Array<{
    serviceType: "personal_photos_8pack" | "card_photos_20pack" | "urgent_fee";
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>>(),
  totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull(),
  paidAmount: numeric("paid_amount", { precision: 10, scale: 2 }).notNull(),
  remainingAmount: numeric("remaining_amount", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: text("payment_method").notNull(),
  expectedDeliveryTime: timestamp("expected_delivery_time", { withTimezone: true }),
  status: text("status").notNull().default("NEW"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertOrderSchema = createInsertSchema(ordersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;
