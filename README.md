# AIMaha Kruksetra WMS

Monorepo foundation for an omnichannel warehouse management system built with `Next.js`, `Node.js`, `PostgreSQL`, and `Supabase`.

## Workspace
- `apps/web`: Next.js admin dashboard and operator PWA
- `apps/api`: Node.js domain API, webhooks, and jobs entrypoint
- `packages/shared`: shared contracts, enums, and Zod schemas
- `packages/db`: Drizzle schema and database helpers
- `docs/`: delivery, engineering, and multi-agent guidance

## Commands
- `pnpm install`: install workspace dependencies
- `pnpm dev`: run the web app and API together
- `pnpm build`: build every workspace package
- `pnpm env:check`: validate hosted Supabase runtime and migration settings
- `pnpm lint`: run ESLint across the repo
- `pnpm typecheck`: run TypeScript checks
- `pnpm test`: run unit and integration tests
- `pnpm test:e2e`: run Playwright smoke tests
- `pnpm db:generate`: generate SQL artifacts from the Drizzle schema
- `pnpm db:migrate`: apply SQL migrations to hosted Supabase
- `pnpm db:migrate:direct`: apply migrations directly with Drizzle and `DATABASE_MIGRATION_URL`
- `pnpm supabase:link`: link the workspace to a hosted Supabase project
- `pnpm supabase:migrations`: compare local migration files with remote history
- `pnpm supabase:push`: push pending SQL migrations to hosted Supabase
- `pnpm supabase:push:seed`: push pending migrations and apply `supabase/seed.sql`
- `pnpm supabase:local:start`: optional Docker-based local stack
- `pnpm supabase:local:reset`: optional local reset and reseed

## Hosted Data Mode
- Copy `.env.example` to `.env.local` before starting the apps
- Set `WMS_STORAGE=db` to use the Drizzle/Supabase-backed warehouse state
- Set `WMS_STORAGE=memory` to force the in-memory fallback for API-only development
- If `WMS_STORAGE` is not `memory`, the API uses the database whenever `DATABASE_URL` is present
- The Next.js app and API both read root `.env.local`, with `.env` as a lower-priority fallback
- `DATABASE_URL` is the runtime connection for the API
- `DATABASE_MIGRATION_URL` is the preferred direct connection for schema pushes; if it is not set, the remote scripts fall back to linked-project mode with `SUPABASE_PROJECT_REF` and `SUPABASE_DB_PASSWORD`
- This repo does not require Docker when you are using hosted Supabase

## Local Auth
- Protected API routes now require an authenticated actor with an allowed application role
- Supabase bearer tokens are verified with `SUPABASE_JWT_SECRET`, then resolved against the `users` and `roles` tables
- Postgres RLS policies now protect the public warehouse tables for Supabase-authenticated access, using `auth.uid() = public.users.id`
- For local and test-only API work, set `ALLOW_DEV_AUTH_HEADERS=true` and send headers such as:
  - `x-dev-user-id: 90000000-0000-0000-0000-000000000003`
  - `x-dev-email: receiver@local.test`
  - `x-dev-role: receiver`
- Seeded local users include `admin@local.test`, `manager@local.test`, `receiver@local.test`, `picker@local.test`, and `packer@local.test`
- The Next.js app now exposes `/sign-in`, which sets an `httpOnly` session cookie for either a local role session or a pasted bearer token
- Protected pages attach auth headers server-side before calling the API, and they redirect back to `/sign-in` when the session is missing or expired
- The current Node API still uses its own server-side DB connection, so API role checks remain required even with RLS enabled

## Hosted Supabase Setup
1. Create a Supabase project, then fill `.env.local` with the project URL, API keys, JWT secret, runtime `DATABASE_URL`, and either `DATABASE_MIGRATION_URL` or the linked-project pair `SUPABASE_PROJECT_REF` plus `SUPABASE_DB_PASSWORD`.
2. Run `pnpm env:check`.
3. If you are using linked-project mode, run `pnpm supabase:link`.
4. Run `pnpm supabase:migrations` to inspect local versus remote state.
5. Run `pnpm supabase:push:seed` for the first bootstrap, then `pnpm supabase:push` for normal schema updates.
6. Start the apps with `pnpm dev`.

## Immediate Focus
The current scaffold now includes the first operational slice:
- shared WMS contracts for products, inventory, and receiving workflows
- initial PostgreSQL schema for core warehouse entities
- Fastify API endpoints for dashboard, products, inventory, receiving queue, receipt confirmation, and put-away
- database-backed receiving, inventory, movement, and audit persistence with in-memory fallback for tests
- role-protected API access with Supabase JWT verification and seeded local users
- Next.js protected pages with cookie-backed sessions and live receiving actions
- SRS, engineering playbook, and multi-agent operating model
