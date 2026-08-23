import { pgTable, serial, integer, text, numeric, timestamp } from "drizzle-orm/pg-core";

export const paymentTransactionsTable = pgTable("payment_transactions", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: text("payment_method").notNull(),
  type: text("type").notNull().default("COLLECTION"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PaymentTransaction = typeof paymentTransactionsTable.$inferSelect;
