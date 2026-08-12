import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? process.env.POSTGRES_PRISMA_URL ?? process.env.POSTGRES_URL_NON_POOLING ?? process.env.DATABASE_POSTGRES_URL;

function getDatabaseUrl(): string {
  if (databaseUrl) return databaseUrl;
  const host = process.env.PGHOST ?? process.env.POSTGRES_HOST;
  const user = process.env.PGUSER ?? process.env.POSTGRES_USER;
  const password = process.env.PGPASSWORD ?? process.env.POSTGRES_PASSWORD;
  const database = process.env.PGDATABASE ?? process.env.POSTGRES_DATABASE;
  const port = process.env.PGPORT ?? process.env.POSTGRES_PORT ?? "5432";
  if (host && user && password && database) return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${encodeURIComponent(database)}`;
  throw new Error("No PostgreSQL connection is configured. Set DATABASE_URL or POSTGRES_URL in the Vercel project environment variables, then redeploy.");
}

export const pool = new Pool({ connectionString: getDatabaseUrl() });
export const db = drizzle(pool, { schema });
let schemaReady: Promise<void> | null = null;

export function ensureDatabaseSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await db.execute(sql`CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY, order_number TEXT NOT NULL UNIQUE, customer_name TEXT, customer_mobile TEXT NOT NULL,
        customer_type TEXT NOT NULL DEFAULT 'walk-in', services JSONB NOT NULL, total_amount NUMERIC(10,2) NOT NULL,
        paid_amount NUMERIC(10,2) NOT NULL, remaining_amount NUMERIC(10,2) NOT NULL, payment_method TEXT NOT NULL,
        expected_delivery_time TIMESTAMPTZ, status TEXT NOT NULL DEFAULT 'NEW', notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS smp_roles (id SERIAL PRIMARY KEY, name TEXT NOT NULL UNIQUE, description TEXT,
          status TEXT NOT NULL DEFAULT 'ACTIVE', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
        CREATE TABLE IF NOT EXISTS smp_permissions (id SERIAL PRIMARY KEY, key TEXT NOT NULL UNIQUE, name TEXT NOT NULL, module TEXT NOT NULL,
          action TEXT NOT NULL, description TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
        CREATE TABLE IF NOT EXISTS smp_users (id SERIAL PRIMARY KEY, name TEXT NOT NULL, username TEXT NOT NULL UNIQUE,
          role_id INTEGER REFERENCES smp_roles(id) ON DELETE SET NULL, branch_id INTEGER, status TEXT NOT NULL DEFAULT 'ACTIVE',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
        CREATE TABLE IF NOT EXISTS smp_branches (id SERIAL PRIMARY KEY, name TEXT NOT NULL, code TEXT NOT NULL UNIQUE,
          address TEXT, phone TEXT, manager_user_id INTEGER, status TEXT NOT NULL DEFAULT 'ACTIVE',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'smp_users_branch_fk') THEN
            ALTER TABLE smp_users ADD CONSTRAINT smp_users_branch_fk FOREIGN KEY (branch_id) REFERENCES smp_branches(id) ON DELETE SET NULL;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'smp_branches_manager_fk') THEN
            ALTER TABLE smp_branches ADD CONSTRAINT smp_branches_manager_fk FOREIGN KEY (manager_user_id) REFERENCES smp_users(id) ON DELETE SET NULL;
          END IF;
        END $$;
        CREATE TABLE IF NOT EXISTS smp_role_permissions (role_id INTEGER NOT NULL REFERENCES smp_roles(id) ON DELETE CASCADE,
          permission_id INTEGER NOT NULL REFERENCES smp_permissions(id) ON DELETE CASCADE, PRIMARY KEY (role_id, permission_id));
        CREATE TABLE IF NOT EXISTS smp_services (id SERIAL PRIMARY KEY, name TEXT NOT NULL, code TEXT NOT NULL UNIQUE,
          price NUMERIC(10,2) NOT NULL DEFAULT 0, description TEXT, status TEXT NOT NULL DEFAULT 'ACTIVE',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
        CREATE TABLE IF NOT EXISTS smp_packages (id SERIAL PRIMARY KEY, name TEXT NOT NULL, code TEXT NOT NULL UNIQUE,
          price NUMERIC(10,2) NOT NULL DEFAULT 0, description TEXT, status TEXT NOT NULL DEFAULT 'ACTIVE',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
        CREATE TABLE IF NOT EXISTS smp_inventory_items (id SERIAL PRIMARY KEY, name TEXT NOT NULL, sku TEXT NOT NULL UNIQUE,
          category TEXT, unit TEXT NOT NULL DEFAULT 'piece', quantity NUMERIC(12,2) NOT NULL DEFAULT 0, minimum_quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'ACTIVE', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());`);
      await db.execute(sql`
        INSERT INTO smp_roles (name, description) VALUES
          ('Admin','Full system access'),('Branch Manager','Manage assigned branch'),('Reception','Orders, payments and archive'),
          ('Photographer','Photography queue'),('Designer','Editing and printing queue'),('Delivery','Delivery station'),('Inventory Manager','Inventory management') ON CONFLICT (name) DO NOTHING;
        INSERT INTO smp_permissions (key,name,module,action) VALUES
          ('admin.access','Access Administration','Admin','access'),('users.view','View Users','Users','view'),('users.create','Create Users','Users','create'),
          ('users.edit','Edit Users','Users','edit'),('users.delete','Delete Users','Users','delete'),('branches.manage','Manage Branches','Branches','manage'),
          ('roles.manage','Manage Roles','Roles','manage'),('permissions.manage','Manage Permissions','Permissions','manage'),
          ('services.manage','Manage Services','Services','manage'),('packages.manage','Manage Packages','Packages','manage'),('inventory.manage','Manage Inventory','Inventory','manage') ON CONFLICT (key) DO NOTHING;`);
    })().catch((error) => { schemaReady = null; throw error; });
  }
  return schemaReady;
}

export * from "./schema";
