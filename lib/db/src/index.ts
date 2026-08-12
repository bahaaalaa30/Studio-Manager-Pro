import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

let schemaReady: Promise<void> | null = null;

/**
 * Vercel deployments may point at a fresh Postgres database where the
 * application schema has not been pushed yet. Keep the prototype self-healing
 * by creating the orders table on first request when it does not exist.
 */
export function ensureDatabaseSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS orders (
          id SERIAL PRIMARY KEY,
          order_number TEXT NOT NULL UNIQUE,
          customer_name TEXT,
          customer_mobile TEXT NOT NULL,
          customer_type TEXT NOT NULL DEFAULT 'walk-in',
          services JSONB NOT NULL,
          total_amount NUMERIC(10, 2) NOT NULL,
          paid_amount NUMERIC(10, 2) NOT NULL,
          remaining_amount NUMERIC(10, 2) NOT NULL,
          payment_method TEXT NOT NULL,
          expected_delivery_time TIMESTAMPTZ,
          status TEXT NOT NULL DEFAULT 'NEW',
          notes TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }

  return schemaReady;
}

export * from "./schema";
