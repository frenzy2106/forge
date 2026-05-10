# Forge

Personal strength training + body composition tracker for one user (Ankit).
Live workout logging on phone → "this session vs last session" comparison →
monthly InBody body-comp correlation.

See `.planning/PROJECT.md` for full context (note: `.planning/` is gitignored;
it is the planner's working area, not a deliverable).

## Stack

- Next.js 16.1.6 (App Router, Server Actions, Turbopack)
- React 19.2.3 + TypeScript 5.x strict
- Tailwind CSS v4 + shadcn/ui (Nova preset)
- Drizzle ORM 0.45 + Drizzle Kit
- Turso (libSQL/SQLite) via `@libsql/client`
- Vercel Hobby (deploy on `git push origin main`)

## Local development

1. Copy `.env.local.example` to `.env.local` and fill in Turso credentials.
   - For zero-account quick start: set `TURSO_DATABASE_URL=file:./local.db`
     and leave the auth token blank. A local SQLite file will be created.
   - For real cloud DB: paste the values from
     `turso db show forge-prod --url` and `turso db tokens create forge-prod`.
2. `pnpm install`
3. `pnpm db:migrate` (applies pending Drizzle migrations to the DB pointed
   at by `TURSO_DATABASE_URL`)
4. `pnpm dev` → <http://localhost:3000>

## Deploy

Push to `main`. Vercel auto-deploys via its GitHub integration. The `build`
script runs `drizzle-kit migrate` against the prod Turso DB before building
Next.js, so schema changes ship atomically with the code that depends on them.

Required Vercel env vars (set in dashboard → Project → Settings → Environment
Variables, for **Production**, **Preview**, and **Development**):

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`

## Project layout

- `src/app/` — App Router pages, layouts, Server Actions
- `src/db/` — Drizzle schema (`schema.ts`) and client (`client.ts`)
- `src/lib/` — Pure helpers (dates, etc.)
- `src/components/` — UI components (`ui/` is shadcn-managed)
- `drizzle/migrations/` — Generated SQL migrations (committed)
