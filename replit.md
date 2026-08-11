# Studio Management System

A comprehensive photo studio operations hub for managing walk-in customer orders through the full workflow: Reception → Photography → Editing → Printing → Delivery.

## Run & Operate

- `pnpm --filter @workspace/studio-management run dev` — run the frontend (port auto-assigned)
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS, TanStack Query, Wouter, Recharts
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI contract (source of truth)
- `lib/db/src/schema/orders.ts` — Orders table definition
- `artifacts/api-server/src/routes/orders.ts` — Order CRUD + status/payment endpoints
- `artifacts/api-server/src/routes/analytics.ts` — Today's analytics endpoint
- `artifacts/studio-management/src/` — Frontend React app

## Architecture decisions

- Orders store services as JSONB (flexible service array, no join table needed for this prototype)
- Status transitions are unrestricted server-side — the UI enforces valid transitions via button visibility
- Analytics are computed on-the-fly from the orders table (no separate analytics table for prototype scale)
- Date filtering defaults to today; delivery/search pages disable date filter when a search query is present

## Product

7 role-based views accessible from the sidebar:
1. **Reception** — New order form with service picker, live pricing, payment panel, order ticket on submit
2. **Photography** — Queue for WAITING_PHOTOGRAPHY / IN_PHOTOGRAPHY with Start/Finish actions
3. **Editing** — Queue for WAITING_EDITING / EDITING with Start/Finish actions
4. **Printing** — Queue for WAITING_PRINT / PRINTING with Start/Finish actions
5. **Delivery** — Search orders, collect remaining payment, mark as delivered
6. **Admin** — Today's metrics cards + status/revenue charts
7. **Customer Track** — Customer-facing order progress stepper by order number

Order number format: `PS-YYYYMMDD-XXXXX`
Pricing: Personal Photos 8-pack = 80 EGP, Card Photos 20-pack = 150 EGP, Urgent fee = 50 EGP
Payment methods: Cash, Visa, InstaPay, Vodafone Cash

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After changing `lib/db/src/schema/`, run `pnpm run typecheck:libs` before typechecking API server packages, or stale declarations will cause TS2305 errors.
- Queue pages poll every 15 seconds (`refetchInterval: 15000`); analytics polls every 30 seconds.
- `pnpm --filter @workspace/db run push-force` if column conflicts arise during schema changes.
