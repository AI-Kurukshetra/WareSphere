# Vercel Deployment

Deploy this repo as two Vercel projects:

## 1. Web Project
- Root directory: `apps/web`
- Framework preset: `Next.js`
- Install command: `pnpm install --frozen-lockfile`
- Build command: `pnpm build`

Required environment variables:
- `API_BASE_URL=https://<api-project>.vercel.app`
- `SUPABASE_URL=https://<project-ref>.supabase.co`
- `SUPABASE_ANON_KEY=<anon-key>`
- `ALLOW_DEV_AUTH_HEADERS=false`

Optional public fallbacks:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 2. API Project
- Root directory: `apps/api`
- Framework preset: `Other`
- Install command: `pnpm install --frozen-lockfile`
- Build command: `pnpm build`

Required environment variables:
- `WMS_STORAGE=db`
- `DATABASE_URL=<runtime-postgres-url>`
- `SUPABASE_URL=https://<project-ref>.supabase.co`
- `ALLOW_DEV_AUTH_HEADERS=false`

Auth verification:
- Set `SUPABASE_JWT_SECRET` if your Supabase project issues `HS256` access tokens.
- If your project uses `ES256`, the API can verify tokens through Supabase JWKS using `SUPABASE_URL`.

## Pre-Deploy Checks
- Run `pnpm deploy:check:web`
- Run `pnpm deploy:check:api`
- Run `pnpm build`
- Run `pnpm test`

## CI/CD
- GitHub Actions CI runs on every pull request and every push to `main`.
- Production CD now lives in `.github/workflows/deploy.yml`.
- The deploy workflow starts only after the `CI` workflow finishes successfully for a push to `main`.
- Add the GitHub repository secret `VERCEL_TOKEN` so Actions can deploy both Vercel projects.
- The current workflow is pinned to the existing Vercel org and project IDs for:
  - `aimaha-kruksetra-wms-web`
  - `aimaha-kruksetra-wms-api`
- If you recreate either Vercel project, update those IDs in `.github/workflows/deploy.yml`.

## Post-Deploy Smoke Checks
- API health: `https://<api-project>.vercel.app/api/health`
- Web sign-in page loads
- Email sign-in succeeds
- Receiving, inventory, and orders pages load with live API data

## Notes
- Do not enable `ALLOW_DEV_AUTH_HEADERS` in preview or production.
- `apps/api/api/v1/[...route].ts` is the Vercel serverless entrypoint for the Fastify API.
- Keep `.env.example` as placeholders only. Never commit live credentials.
