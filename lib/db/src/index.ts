import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

/**
 * Replit exposes DATABASE_URL, while Vercel Postgres/Neon integrations may
 * expose POSTGRES_URL (and, depending on the integration, one of the other
 * POSTGRES_* connection variables). Prefer DATABASE_URL when available but
 * accept the common Vercel-managed names as well.
 */
const databaseUrl =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL ??
  process.env.POSTGRES_PRISMA_URL ??
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.DATABASE_POSTGRES_URL;

function getDatabaseUrl(): string {
  if (databaseUrl) {
    return databaseUrl;
  }

  // Some managed Postgres integrations expose the connection parts instead
  // of a single URL. Build a URL when those variables are available.
  const host = process.env.PGHOST ?? process.env.POSTGRES_HOST;
  const user = process.env.PGUSER ?? process.env.POSTGRES_USER;
  const password = process.env.PGPASSWORD ?? process.env.POSTGRES_PASSWORD;
  const database = process.env.PGDATABASE ?? process.env.POSTGRES_DATABASE;
  const port = process.env.PGPORT ?? process.env.POSTGRES_PORT ?? "5432";

  if (host && user && password && database) {
    return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${encodeURIComponent(database)}`;
  }

  throw new Error(
    "No PostgreSQL connection is configured. Set DATABASE_URL or POSTGRES_URL in the Vercel project environment variables, then redeploy.",
  );
}

export const pool = new Pool({ connectionString: getDatabaseUrl() });
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
