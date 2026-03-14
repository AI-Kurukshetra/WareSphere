# Hosted Supabase Workflow

This repository is set up for `Node.js + PostgreSQL + hosted Supabase`. Docker is optional and not part of the default path.

## Required Environment
- `DATABASE_URL`: runtime database URL used by the API
- `SUPABASE_URL`: project URL such as `https://<project-ref>.supabase.co`
- `SUPABASE_ANON_KEY`: web client key
- `SUPABASE_JWT_SECRET`: JWT verification secret used by the API for `HS256` projects

## Recommended Migration Environment
- `DATABASE_MIGRATION_URL`: direct Postgres URL for non-interactive schema pushes
- `SUPABASE_PROJECT_REF`: required when using linked-project mode instead of `DATABASE_MIGRATION_URL`
- `SUPABASE_DB_PASSWORD`: remote database password for Supabase CLI commands
- `SUPABASE_ACCESS_TOKEN`: recommended for non-interactive `supabase` CLI access

## Bootstrap Sequence
1. Copy `.env.example` to `.env.local` and fill in the hosted project values.
2. Run `pnpm env:check`.
3. Use one migration mode:
   - Direct URL mode: set `DATABASE_MIGRATION_URL`, then run `pnpm supabase:push:seed`.
   - Linked project mode: run `pnpm supabase:link`, then run `pnpm supabase:push:seed`.
4. Start the apps with `pnpm dev`.

## Ongoing Schema Changes
- Update the Drizzle schema in `packages/db/src/schema.ts`.
- Generate SQL with `pnpm db:generate`.
- Review the SQL under `supabase/migrations/`.
- Apply it with `pnpm supabase:push`.

## Notes
- `pnpm db:migrate` is an alias for the hosted Supabase push workflow.
- `pnpm db:migrate:direct` keeps the direct Drizzle migration path available when needed.
- RLS protects Supabase-authenticated database access, but the Node API still enforces role checks on server-side queries.
- If your Supabase project uses `ES256`, the API can validate bearer tokens from Supabase JWKS using `SUPABASE_URL`.
