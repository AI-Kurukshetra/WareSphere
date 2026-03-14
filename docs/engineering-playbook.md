# Engineering Playbook

## Required Skills
- `srs-writer`: keeps `SRS.md` build-ready and workflow based
- `wms-domain-analyst`: owns actor matrix, exception flows, and KPI definitions
- `supabase-backend`: owns schema, RLS, and auth integration
- `node-api-designer`: owns service contracts, jobs, and webhook handling
- `nextjs-pwa-builder`: owns dashboard and operator scanning UX
- `qa-test-planner`: owns regression coverage and release gates
- `integration-mapper`: owns Shopify and WooCommerce data contracts

## Build Rules
- Use TypeScript across all application code.
- Keep API contracts in `packages/shared` and consume them from both apps.
- Treat PostgreSQL as the system of record for inventory and order state.
- Every inventory mutation must create an audit trail entry.
- Use migrations only; do not make manual production schema edits.
- Webhooks must be idempotent and replay-safe.
- Build mobile warehouse flows as a PWA before discussing native apps.
- Add tests with each workflow, not after the fact.

## Default Tooling
- `pnpm` + Turborepo for workspace management
- `Next.js` for web and PWA
- `Fastify` on Node.js for API services
- `Drizzle` for schema and migrations
- `Supabase` for Postgres, Auth, Storage, and Realtime
- `Vitest` for unit and integration tests
- `Playwright` for end-to-end tests
- `ESLint` + `Prettier` for repo hygiene

