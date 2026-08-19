import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import pg from "pg";
import * as schema from "./schema";
const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? process.env.POSTGRES_PRISMA_URL ?? process.env.POSTGRES_URL_NON_POOLING ?? process.env.DATABASE_POSTGRES_URL;
function getDatabaseUrl(): string { if (databaseUrl) return databaseUrl; const host = process.env.PGHOST ?? process.env.POSTGRES_HOST; const user = process.env.PGUSER ?? process.env.POSTGRES_USER; const password = process.env.PGPASSWORD ?? process.env.POSTGRES_PASSWORD; const database = process.env.PGDATABASE ?? process.env.POSTGRES_DATABASE; const port = process.env.PGPORT ?? process.env.POSTGRES_PORT ?? "5432"; if (host && user && password && database) return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${encodeURIComponent(database)}`; throw new Error("No PostgreSQL connection is configured. Set DATABASE_URL or POSTGRES_URL in the Vercel project environment variables, then redeploy."); }
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
          password_hash TEXT, password_set_at TIMESTAMPTZ, last_login_at TIMESTAMPTZ, must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
          failed_login_attempts INTEGER NOT NULL DEFAULT 0, locked_until TIMESTAMPTZ, role_id INTEGER REFERENCES smp_roles(id) ON DELETE SET NULL,
          branch_id INTEGER, status TEXT NOT NULL DEFAULT 'ACTIVE', address TEXT, phone TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
        CREATE TABLE IF NOT EXISTS smp_branches (id SERIAL PRIMARY KEY, name TEXT NOT NULL, code TEXT NOT NULL UNIQUE,
          address TEXT, phone TEXT, manager_user_id INTEGER, status TEXT NOT NULL DEFAULT 'ACTIVE',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'smp_users_branch_fk') THEN ALTER TABLE smp_users ADD CONSTRAINT smp_users_branch_fk FOREIGN KEY (branch_id) REFERENCES smp_branches(id) ON DELETE SET NULL; END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'smp_branches_manager_fk') THEN ALTER TABLE smp_branches ADD CONSTRAINT smp_branches_manager_fk FOREIGN KEY (manager_user_id) REFERENCES smp_users(id) ON DELETE SET NULL; END IF;
        END $$;
        ALTER TABLE smp_users ADD COLUMN IF NOT EXISTS password_hash TEXT;
        ALTER TABLE smp_users ADD COLUMN IF NOT EXISTS password_set_at TIMESTAMPTZ;
        ALTER TABLE smp_users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
        ALTER TABLE smp_users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
        ALTER TABLE smp_users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE smp_users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
        ALTER TABLE smp_users ADD COLUMN IF NOT EXISTS address TEXT;
        ALTER TABLE smp_users ADD COLUMN IF NOT EXISTS phone TEXT;
        CREATE TABLE IF NOT EXISTS smp_role_permissions (role_id INTEGER NOT NULL REFERENCES smp_roles(id) ON DELETE CASCADE,
          permission_id INTEGER NOT NULL REFERENCES smp_permissions(id) ON DELETE CASCADE, PRIMARY KEY (role_id, permission_id));
        CREATE TABLE IF NOT EXISTS smp_user_permissions (user_id INTEGER NOT NULL REFERENCES smp_users(id) ON DELETE CASCADE,
          permission_id INTEGER NOT NULL REFERENCES smp_permissions(id) ON DELETE CASCADE, granted BOOLEAN NOT NULL DEFAULT TRUE,
          PRIMARY KEY (user_id, permission_id));
        CREATE TABLE IF NOT EXISTS smp_services (id SERIAL PRIMARY KEY, name TEXT NOT NULL, code TEXT NOT NULL UNIQUE, price NUMERIC(10,2) NOT NULL DEFAULT 0, description TEXT, status TEXT NOT NULL DEFAULT 'ACTIVE', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
        ALTER TABLE smp_services ADD COLUMN IF NOT EXISTS is_free BOOLEAN NOT NULL DEFAULT FALSE;
        ALTER TABLE smp_services ADD COLUMN IF NOT EXISTS urgent_allowed BOOLEAN NOT NULL DEFAULT FALSE;
        ALTER TABLE smp_services ADD COLUMN IF NOT EXISTS urgent_price NUMERIC(10,2);
        ALTER TABLE smp_services ADD COLUMN IF NOT EXISTS normal_delivery_days INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE smp_services ADD COLUMN IF NOT EXISTS urgent_delivery_days INTEGER;
        DROP INDEX IF EXISTS smp_services_name_unique_idx;
        DO $$ DECLARE idx RECORD; BEGIN
          FOR idx IN
            SELECT indexname FROM pg_indexes
            WHERE schemaname = current_schema()
              AND tablename = 'smp_services'
              AND indexdef ILIKE 'CREATE UNIQUE INDEX%'
              AND indexdef ILIKE '%lower(trim(name))%'
          LOOP
            EXECUTE format('DROP INDEX IF EXISTS %I', idx.indexname);
          END LOOP;
        END $$;
        CREATE TABLE IF NOT EXISTS smp_packages (id SERIAL PRIMARY KEY, name TEXT NOT NULL, code TEXT NOT NULL UNIQUE, price NUMERIC(10,2) NOT NULL DEFAULT 0, description TEXT, status TEXT NOT NULL DEFAULT 'ACTIVE', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
        CREATE TABLE IF NOT EXISTS smp_inventory_items (id SERIAL PRIMARY KEY, name TEXT NOT NULL, sku TEXT NOT NULL UNIQUE, category TEXT, unit TEXT NOT NULL DEFAULT 'piece', quantity NUMERIC(12,2) NOT NULL DEFAULT 0, minimum_quantity NUMERIC(12,2) NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'ACTIVE', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());`);
      await db.execute(sql`UPDATE smp_services SET is_free = TRUE, price = 0, urgent_price = NULL, urgent_allowed = FALSE, urgent_delivery_days = NULL WHERE price = 0 AND is_free = FALSE`);
      await db.execute(sql`UPDATE smp_services SET urgent_allowed = FALSE, urgent_price = NULL, urgent_delivery_days = NULL WHERE urgent_allowed IS FALSE`);
      await db.execute(sql`
        INSERT INTO smp_roles (name, description) VALUES
          ('Admin','Full system access'),('Branch Manager','Manage assigned branch'),('Reception','Orders, payments and archive'),
          ('Photographer','Photography queue'),('Designer','Editing and printing queue'),('Delivery','Delivery station'),('Inventory Manager','Inventory management') ON CONFLICT (name) DO NOTHING;
        INSERT INTO smp_permissions (key,name,module,action) VALUES
          ('admin.access','Access Administration','Admin','access'),('users.view','View Users','Users','view'),('users.create','Create Users','Users','create'),('users.edit','Edit Users','Users','edit'),('users.delete','Delete Users','Users','delete'),
          ('branches.manage','Manage Branches','Branches','manage'),('roles.manage','Manage Roles','Roles','manage'),('permissions.manage','Manage Permissions','Permissions','manage'),
          ('services.manage','Manage Services','Services','manage'),('packages.manage','Manage Packages','Packages','manage'),
          ('inventory.view','View Inventory','Inventory','view'),('inventory.manage','Manage Inventory','Inventory','manage'),
          ('orders.view','View Orders','Orders','view'),('orders.create','Create Orders','Orders','create'),('orders.edit','Edit Orders','Orders','edit'),('orders.delete','Delete Orders','Orders','delete'),('orders.payment','Manage Order Payments','Orders','payment'),('analytics.view','View Analytics','Analytics','view'),
          ('reception.view','Access Reception','Reception','view'),('photography.view','Access Photography','Photography','view'),('editing.view','Access Editing','Editing','view'),('printing.view','Access Printing','Printing','view'),('delivery.view','Access Delivery','Delivery','view'),('archive.view','View Archive','Archive','view'),('track.view','Customer Tracking','Customer Track','view')
          ON CONFLICT (key) DO NOTHING;
        INSERT INTO smp_role_permissions (role_id, permission_id) SELECT r.id, p.id FROM smp_roles r CROSS JOIN smp_permissions p WHERE r.name = 'Admin' ON CONFLICT DO NOTHING;
        INSERT INTO smp_role_permissions (role_id, permission_id) SELECT r.id, p.id FROM smp_roles r JOIN smp_permissions p ON p.key IN ('orders.view','orders.create','orders.edit','orders.payment','inventory.view','analytics.view','branches.manage','reception.view','photography.view','editing.view','printing.view','delivery.view','archive.view','track.view') WHERE r.name = 'Branch Manager' ON CONFLICT DO NOTHING;
        INSERT INTO smp_role_permissions (role_id, permission_id) SELECT r.id, p.id FROM smp_roles r JOIN smp_permissions p ON p.key IN ('orders.view','orders.create','orders.edit','orders.payment','reception.view','archive.view','track.view') WHERE r.name = 'Reception' ON CONFLICT DO NOTHING;
        INSERT INTO smp_role_permissions (role_id, permission_id) SELECT r.id, p.id FROM smp_roles r JOIN smp_permissions p ON p.key IN ('orders.view','orders.edit','photography.view') WHERE r.name = 'Photographer' ON CONFLICT DO NOTHING;
        INSERT INTO smp_role_permissions (role_id, permission_id) SELECT r.id, p.id FROM smp_roles r JOIN smp_permissions p ON p.key IN ('orders.view','orders.edit','editing.view','printing.view') WHERE r.name = 'Designer' ON CONFLICT DO NOTHING;
        INSERT INTO smp_role_permissions (role_id, permission_id) SELECT r.id, p.id FROM smp_roles r JOIN smp_permissions p ON p.key IN ('orders.view','orders.edit','delivery.view') WHERE r.name = 'Delivery' ON CONFLICT DO NOTHING;
        INSERT INTO smp_role_permissions (role_id, permission_id) SELECT r.id, p.id FROM smp_roles r JOIN smp_permissions p ON p.key IN ('inventory.view','inventory.manage') WHERE r.name = 'Inventory Manager' ON CONFLICT DO NOTHING;
      `);
    })().catch((error) => { schemaReady = null; throw error; });
  }
  return schemaReady;
}
export * from "./schema";
