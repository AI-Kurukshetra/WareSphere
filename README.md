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
- `pnpm deploy:check`: validate production deployment env for both web and API targets
- `pnpm deploy:check:web`: validate the Vercel web deployment env
- `pnpm deploy:check:api`: validate the Vercel API deployment env
- `pnpm env:check`: validate hosted Supabase runtime and migration settings
- `pnpm lint`: run ESLint across the repo
- `pnpm typecheck`: run TypeScript checks
- `pnpm test`: run unit and integration tests
- `pnpm test:e2e:install`: install the Chromium browser used by Playwright
- `pnpm test:e2e`: build the apps, then run the Playwright smoke suite
- `pnpm test:e2e:headed`: build the apps, then run Playwright interactively in Chromium
- `pnpm test:e2e:demo`: build the apps, then run the scripted warehouse demo flow and keep video output
- `pnpm test:e2e:demo:headed`: build the apps, then run the full warehouse demo flow in headed Chromium with slower actions for recording
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
- Set `API_BASE_URL` to the deployed API origin for server-side web requests
- Set `WMS_STORAGE=db` to use the Drizzle/Supabase-backed warehouse state
- Set `WMS_STORAGE=memory` to force the in-memory fallback for API-only development
- If `WMS_STORAGE` is not `memory`, the API uses the database whenever `DATABASE_URL` is present
- The Next.js app and API both read root `.env.local`, with `.env` as a lower-priority fallback
- `NEXT_PUBLIC_API_BASE_URL` is a local/dev fallback only; prefer `API_BASE_URL`
- `DATABASE_URL` is the runtime connection for the API
- `DATABASE_MIGRATION_URL` is the preferred direct connection for schema pushes; if it is not set, the remote scripts fall back to linked-project mode with `SUPABASE_PROJECT_REF` and `SUPABASE_DB_PASSWORD`
- This repo does not require Docker when you are using hosted Supabase

## Auth
- Protected API routes now require an authenticated actor with an allowed application role
- Supabase bearer tokens are verified with `SUPABASE_JWT_SECRET` for `HS256` projects or with Supabase JWKS via `SUPABASE_URL` for `ES256` projects, then resolved against the `users` and `roles` tables
- Postgres RLS policies now protect the public warehouse tables for Supabase-authenticated access, using `auth.uid() = public.users.id`
- For local and test-only API work, set `ALLOW_DEV_AUTH_HEADERS=true` and send headers such as:
  - `x-dev-user-id: 90000000-0000-0000-0000-000000000003`
  - `x-dev-email: receiver@local.test`
  - `x-dev-role: receiver`
- Dev auth is automatically blocked when `NODE_ENV=production`, even if `ALLOW_DEV_AUTH_HEADERS=true` is set by mistake
- Seeded local users include `admin@local.test`, `manager@local.test`, `receiver@local.test`, `picker@local.test`, and `packer@local.test`
- The Next.js app now exposes `/sign-in`, which shows local-role sign-in only when dev auth is enabled
- Protected pages attach auth headers server-side before calling the API, and they redirect back to `/sign-in` when the session is missing or expired
- The current Node API still uses its own server-side DB connection, so API role checks remain required even with RLS enabled

## Hosted Supabase Setup
1. Create a Supabase project, then fill `.env.local` with the project URL, API keys, JWT secret, runtime `DATABASE_URL`, and either `DATABASE_MIGRATION_URL` or the linked-project pair `SUPABASE_PROJECT_REF` plus `SUPABASE_DB_PASSWORD`.
2. Run `pnpm env:check`.
3. If you are using linked-project mode, run `pnpm supabase:link`.
4. Run `pnpm supabase:migrations` to inspect local versus remote state.
5. Run `pnpm supabase:push:seed` for the first bootstrap, then `pnpm supabase:push` for normal schema updates.
6. Start the apps with `pnpm dev`.

## Vercel Deployment
- Deploy `apps/web` and `apps/api` as separate Vercel projects
- The API project exposes the existing Fastify routes through Vercel functions under `/api/v1/*`
- Use `pnpm deploy:check:web` and `pnpm deploy:check:api` before creating the Vercel deployments
- CI runs on every pull request and every push to `main`
- After `CI` passes for a push to `main`, `.github/workflows/deploy.yml` deploys both Vercel projects automatically
- Set the GitHub repository secret `VERCEL_TOKEN` before relying on push-based deployment
- Deployment steps and required envs are documented in [vercel-deployment.md](/Users/apple/Documents/GitHub/AIMahaKruksetra/docs/vercel-deployment.md)

## Immediate Focus
The current scaffold now includes the current MVP slices:
- shared WMS contracts for receiving, counts, inventory, outbound, and returns workflows
- initial PostgreSQL schema for core warehouse entities
- Fastify API endpoints for dashboard, products, inventory, count release/confirmation, receiving queue, and outbound execution
- database-backed receiving, inventory, movement, and audit persistence with in-memory fallback for tests
- role-protected API access with Supabase JWT verification and seeded local users
- Next.js protected pages with cookie-backed sessions and live receiving, counts, outbound, and returns actions
- outbound allocation, picking, packing, and shipping workflows
- cycle count and manual inventory adjustment workflows
- returns creation and disposition workflows with inventory impact
- SRS, engineering playbook, and multi-agent operating model

## Playwright Demo Flow
- `playwright.config.ts` starts the built API and web app automatically for e2e runs
- Playwright forces `WMS_STORAGE=memory` and `ALLOW_DEV_AUTH_HEADERS=true` so demo runs start from a clean deterministic state
- `tests/e2e/demo-flow.spec.ts` walks through:
  - receiving and put-away
  - inventory verification
  - cycle count release and variance confirmation
  - manager allocation
  - picker confirmation
  - packer packing
  - shipment dispatch
  - return intake and restock confirmation
- Use `pnpm test:e2e:demo` for a deterministic headless recording run
- Use `pnpm test:e2e:demo:headed` when you want a slower visible walkthrough for live demos or screen capture

## Security Note
- `.env.example` must stay placeholder-only. If any real secrets were copied into tracked files earlier, rotate them before production deployment.
