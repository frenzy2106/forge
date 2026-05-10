<!-- GSD:project-start source:PROJECT.md -->
## Project

**Forge**

Forge is a personal web app for tracking strength workouts and body composition. Ankit logs each set live during gym sessions on his phone, sees how today's session compares against the prior identical session, and uploads monthly InBody scans (CSV) to track body composition trends alongside his progressive overload over time.

**Core Value:** Live, frictionless workout logging that produces a meaningful "this session vs last session" comparison. If everything else fails, this one thing must work.

### Constraints

- **Tech stack**: TBD — research phase will recommend; must support responsive web, simple cloud deploy, and a small structured data model for sets / sessions / scans
- **Hosting**: Cloud, public URL (e.g., Vercel / Fly.io / Railway / similar) — chosen over self-hosted + Tailscale to keep setup friction low
- **Auth**: None for v1 — accept the public-URL exposure tradeoff for low-sensitivity body comp + workout data; deliberately excluding labs/diet from app scope partly for this reason
- **Single-user**: Do not over-engineer for multi-tenancy, isolation, or shared workouts
- **Data sensitivity**: Body composition + workout history are low-medium sensitivity; lab reports (high sensitivity) are explicitly excluded from this app
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## TL;DR — The Stack
| Concern | Pick |
|---------|------|
| Framework | **Next.js 16.1.6** (App Router, Server Actions, Turbopack default) |
| Language | **TypeScript 5.x**, **React 19.2.3** |
| Styling | **Tailwind CSS v4** + **shadcn/ui** (Radix primitives, copy-paste) |
| Forms | **React Hook Form 7.66** + **Zod 4** resolver |
| Charts | **Recharts 3.3** |
| DB | **Turso** (managed libSQL/SQLite) |
| ORM | **Drizzle ORM 0.45.x** + **Drizzle Kit** for migrations |
| CSV ingest | **PapaParse 5.x** |
| Dates | **date-fns v4** |
| Hosting | **Vercel Hobby** (free, personal-use license fits) |
| Deploy | `git push` → auto-deploy via Vercel GitHub integration |
| "Auth" | Long, random subdomain + **Vercel Deployment Protection** on previews + opt-in HTTP basic auth via middleware if discoverability becomes a concern |
| Package manager | **pnpm** |
## Recommended Stack
### Core Technologies
| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| **Next.js** | 16.1.6 | Full-stack React framework: routing, RSC, server actions, API, deploy target | Canonical for Vercel; Server Actions remove the API/client split; Turbopack stable (default in 16) for fast dev cycles; one codebase serves phone + laptop responsively. Used by shadcn/ui's reference app | HIGH |
| **React** | 19.2.3 | UI runtime | Required by Next.js 16; Server Components and `useActionState` make form-heavy live-logging UIs trivially fast | HIGH |
| **TypeScript** | 5.7+ | Type safety end-to-end | Drizzle, Zod, RHF, and Server Actions all give you free types; refusing TS in 2026 is leaving leverage on the table | HIGH |
| **Tailwind CSS** | v4 (4.x) | Utility CSS | Zero-config in v4 (`@import "tailwindcss"` + PostCSS plugin), 5x faster builds, used by shadcn v4. Mobile-first defaults map perfectly to responsive gym UI | HIGH |
| **shadcn/ui** | CLI 3.5+ | Accessible Radix-based component primitives, copy-pasted into your repo | You own the code (no version churn from a vendor), Radix gives a11y for free, looks good on mobile out of the box, integrates Tailwind v4 natively. The de facto choice for Next.js + Tailwind in 2026 | HIGH |
| **Drizzle ORM** | 0.45.x (stable) | Type-safe SQL ORM | TypeScript-first, near-SQL syntax, tiny (~7.4kB), works with libSQL/Turso. **Stable line, not the 1.0-beta** — 1.0 has API churn risk and you're a single dev who shouldn't chase betas | HIGH |
| **Drizzle Kit** | matched to drizzle-orm | Schema migrations CLI | Generates SQL migrations from your schema diff; `drizzle-kit push` is fine for dev, `migrate` for prod | HIGH |
| **Turso** (libSQL) | latest hosted | Database (managed SQLite + replication) | SQLite semantics (the right model for a small structured dataset like sets/sessions/scans), hosted so you don't run infra, **free tier covers this app forever** (5GB storage, 500M row reads/mo). LibSQL driver is portable across runtimes — not locked to Cloudflare like D1 | HIGH |
### Supporting Libraries
| Library | Version | Purpose | When to Use | Confidence |
|---------|---------|---------|-------------|------------|
| **React Hook Form** | 7.66.0 | Form state for live set-logging | Per-set logging is form-heavy; RHF's uncontrolled inputs minimize re-renders, which matters when you tap "Add Set" 30+ times per session on mobile | HIGH |
| **Zod** | 4.x | Schema validation (forms + Server Actions + CSV rows) | Same schema validates the form input, the Server Action payload, and a parsed InBody CSV row. One source of truth, zero duplication | HIGH |
| **`@hookform/resolvers`** | latest | Bridge RHF ↔ Zod | One-liner to make RHF use Zod schemas | HIGH |
| **Recharts** | 3.3.0 | Strength-curve and body-comp trend charts | Declarative React API, SVG, ~150kB, the chart lib shadcn's `<ChartContainer>` wraps. Plenty fast for ≤10 years of monthly InBody points and per-exercise weekly strength data | HIGH |
| **PapaParse** | 5.x | InBody CSV parsing | Fastest browser/Node CSV parser, RFC 4180 compliant, handles InBody's quirky exports cleanly. Used for the Day-1 import of 5 years of scans and ongoing monthly uploads | HIGH |
| **date-fns** | v4 | Date arithmetic (session ordering, "X days since last leg day", monthly InBody bucketing) | Tree-shakeable (~13kB used), TS-first, modular. **Not Temporal yet** — polyfill is 60kB and Node 24 still needs a flag; revisit in 2027 | HIGH |
| **lucide-react** | latest | Icons (matches shadcn defaults) | Tiny per-icon imports; default icon set for shadcn/ui | HIGH |
| **clsx** + **tailwind-merge** | latest | Conditional class composition | Standard companion to shadcn (`cn()` helper); tiny | HIGH |
### Development Tools
| Tool | Purpose | Notes |
|------|---------|-------|
| **pnpm** | Package manager | Faster, deterministic, less disk; `corepack enable` then `pnpm install` |
| **Biome 2.x** *(optional)* | Lint + format in one binary | Faster than ESLint+Prettier; safe to swap in. If you'd rather not learn a new tool, stay with the Next.js default ESLint config |
| **Vitest 2.x** *(when you want tests)* | Unit tests | Native ESM, TS-first, fast; pair with `@testing-library/react`. You won't have many tests in a personal app, but Drizzle schema and CSV-parser tests pay off |
| **TypeScript strict mode** | `"strict": true` in `tsconfig.json` | Non-negotiable. The whole stack is built on the assumption you opt in |
| **GitHub** + **Vercel GitHub integration** | CI/CD | `git push` to `main` → preview/prod deploy. No CI to write |
## Installation
# Scaffold (uses Next 16, App Router, TS, Tailwind v4 by default)
# shadcn/ui
# Data layer
# Forms + validation
# CSV
# Charts (already pulled by shadcn `chart`, but explicit:)
# Dates
# Optional obscurity layer (see Auth-Skip Pattern):
## Decision Rationale (the "why one, not three" section)
### Why Next.js 16 (not Remix / TanStack Start / SvelteKit / Vite-only)
- **Server Actions kill the API layer.** Live set-logging is `<form action={logSet}>` with a server function — no fetch handler, no API contract, types flow from Drizzle straight into the form handler. For a one-person app this is enormous.
- **Vercel deployment is `git push`.** No `Dockerfile`, no GH Actions, no `serverless.yml`.
- **Turbopack is default in 16** — fast `next dev` startup matters when you're iterating from your phone over the local network.
- TanStack Start is closer to ideal in pure DX but is brand-new in 2026; Remix/React Router 7 is fine but loses the Vercel zero-config edge; SvelteKit means walking away from React Hook Form, shadcn/ui, and the entire React Hooks knowledge base.
### Why Server Actions (not tRPC)
- Server Actions ship in the framework, no extra deps, no router setup, progressive enhancement for free.
- The case for tRPC is "lots of cross-page client data fetching with cache invalidation" — not this app. Almost every screen here is `await db.query(...)` in an RSC, with mutations as Server Actions.
- If you ever add a screen that genuinely needs cache-aware client fetching (live "rest timer between sets" with optimistic UI is a candidate), introduce TanStack Query alongside Server Actions then. Don't pre-pay.
### Why SQLite (Turso) over Postgres (Neon / Supabase)
- Single user, low write rate (≤200 sets/week), <5MB lifetime data including 5 years of CSVs. SQLite is the correct **mental model** here — relational, transactional, indexed, but boringly small.
- Turso's free tier is more than 100x your needs. You will never pay.
- Drizzle treats Turso as a first-class target via `drizzle-orm/libsql`.
- Postgres adds: connection-pool considerations on serverless, `pgcrypto`/extension fiddling, more migration ceremony. None of which buy you anything for this app.
- **Why not better-sqlite3 + a file?** Vercel's serverless filesystem is ephemeral; you'd lose data between deploys and need a separate persistence story. Turso solves this without leaving SQLite semantics.
- **Why not Cloudflare D1?** D1 is great if your runtime is already Workers. On Vercel, libSQL is the more portable choice and avoids splitting your hosting between two providers.
### Why Drizzle (not Prisma / Kysely / raw SQL)
- TypeScript-first schema-first ORM with near-SQL syntax — you read your queries and they look like queries, not magic.
- Tiny (~7.4kB), no Rust binary, no separate generation step blocking deploy.
- Prisma's Rust query engine is heavyweight, slower cold-starts on serverless, and Prisma's own community is debating whether to chase Drizzle. In 2026 the tradeoff has clearly tipped.
- Kysely is fine but you'd give up the `drizzle-kit` migration ergonomics.
- **Stay on stable 0.45.x, not 1.0-beta.** Single-dev personal app + active beta API churn = bad math.
### Why React Hook Form (not TanStack Form / Conform / Server Actions alone)
- RHF is the most battle-tested React form lib (24M weekly DLs), uncontrolled inputs minimize re-renders during a heavy logging session, integrates trivially with Zod via `@hookform/resolvers`, and pairs cleanly with shadcn `<Form>` components.
- TanStack Form is technically newer-and-shinier but is a bigger learning surface for ~equal outcome. Pick speed-to-ship.
- Pure Server Actions + `useActionState` is fine for *one-shot* forms (CSV upload, edit profile), but a live set-logging UI with conditional drop-set rows, instant validation, and "Add Set" repetition is exactly what RHF was built for. Use both — Server Actions for submission, RHF for client state.
### Why Recharts (not Visx / Tremor / Chart.js / ECharts)
- shadcn's `<Chart>` component is a Recharts wrapper — you get themed charts that match your UI for free.
- Declarative, SVG, mobile-touch friendly, ~150kB. Tooltips, legends, responsive container all work out of the box.
- Visx is too low-level for this app (you'd be writing axes manually). Tremor bundles Recharts — extra weight you don't need. Chart.js is canvas (harder to style, less React-idiomatic). ECharts is overkill at 500kB+.
- Recharts handles 100s of points fine. You won't approach its scale ceiling for years.
### Why PapaParse (not csv-parse / fast-csv / hand-roll)
- Battle-tested, RFC 4180 compliant, handles BOM/quotes/newlines that InBody exports occasionally include.
- Streams large files (your 5-year history is small but the API is the same).
- Works in both browser (instant client-side preview before upload) and Node (server-side parsing in your Server Action).
### Why date-fns v4 (not Day.js / Luxon / Temporal)
- TypeScript-first, tree-shakeable, modular — you import only `format`, `differenceInDays`, etc.
- Day.js is smaller but its plugin model is clunkier and you'll inevitably need timezone support (gym sessions cross local midnight occasionally).
- Temporal is the *future* — TC39 Stage 4 March 2026 — but the polyfill is 60kB and Node 24 still requires a flag. Revisit in 2027 when Node 26 makes it default.
### Why Vercel (not Fly.io / Railway / Cloudflare Pages / self-hosted)
- **Personal apps are exactly the Hobby tier's intended use case.** Free forever, no card. 100GB bandwidth/month is ~3 orders of magnitude beyond a single-user app.
- Zero-config Next.js deploy: `git push` → preview URL → promote to prod automatically.
- Native integrations with Turso (env injection wizard), GitHub (PR previews), and image/font optimization.
- **Hobby plan is non-commercial only — this app fits the license cleanly.** If you ever monetize, you upgrade to Pro ($20/mo).
- Fly.io / Railway are great for stateful workloads (you don't have one — Turso is your state). Cloudflare Pages would force you toward D1 + Workers and a runtime change. Self-hosted is overkill.
### Why pnpm (not npm / yarn / bun)
- Disk-efficient, fastest install, zero package-manager drama. Bun is interesting but rough edges on Windows + Vercel still want npm/pnpm/yarn lockfiles.
## Auth-Skip Pattern (the user-asked specific question)
### Layer 1 (must do): Obscure subdomain
- Use a `forge-<random-string>.vercel.app` URL or a custom domain like `<random-word>.<your-personal-tld>`.
- Don't link it from anywhere indexed (no GitHub README links, no Twitter mention).
- Add a `robots.txt` blocking all indexing:
- Set `<meta name="robots" content="noindex, nofollow" />` in your root layout.
- This is "security through obscurity" and is honest about it. **Acceptable for body comp + workout data, not for medical records** (which PROJECT.md correctly excludes).
### Layer 2 (recommended): One-line middleware password gate
### Layer 3 (only if L2 isn't enough): Vercel Deployment Protection
- Hobby plan supports protection on **preview** deployments out of the box.
- Production-domain protection requires Pro. **Don't pay for this** — Layer 2 covers you for free.
### What NOT to do
- **Don't add Auth.js / Clerk / WorkOS / Supabase Auth.** It's over-engineering for one user, and the user explicitly said no auth in PROJECT.md.
- **Don't store a password in the DB** — environment variables are simpler and rotatable via Vercel UI.
## Deployment Story
- PR opens → preview deployment with its own URL
- PR merges to `main` → production deployment auto-promoted
- **Dev**: `drizzle-kit push` straight to your dev Turso DB (or a local SQLite file)
- **Prod**: Generate with `drizzle-kit generate`, commit the SQL files, run `drizzle-kit migrate` either as a Vercel build step (`"build": "drizzle-kit migrate && next build"`) or manually via `pnpm migrate:prod` from your laptop
## Workout-Tracker-Specific Templates / Clones?
| Project | URL | Verdict |
|---------|-----|---------|
| `Tatooles/next-fitness-tracker` | github.com/Tatooles/next-fitness-tracker | Next.js + workout focus, but stale stack and dialect-different data model. Reading it for inspiration is fine; forking is a trap |
| `kautilyadevaraj/FitnessTracker` | github.com/kautilyadevaraj/FitnessTracker | Next.js + Supabase + Prisma + NextAuth + AI extras — opposite of your "single-user, no auth, no AI" constraint stack. Drop |
| `Heavytaper/workout-tracker` | github.com/Heavytaper/workout-tracker | PWA-focused (you've explicitly excluded PWA), Push/Pull/Legs theme aligned but architecturally diverged |
| OpenTrainer (Convex + Next.js) | dev.to writeup | Convex is a bold dependency choice — interesting "two taps per set" UX worth studying, **but don't adopt Convex**: it's a backend lock-in you don't need |
| `bassiarmaan/hevy-workout-tracker` | github.com/bassiarmaan/hevy-workout-tracker | Hevy data analyzer, not a logger. Useful as inspiration for the analysis screens only |
- **Hevy's UX**: large numeric steppers for reps/weight, last-session ghost values pre-filled, swipe to delete a set, inline drop-set rows.
- **Strong's session-summary screen**: side-by-side "today vs last" with PR badges.
- **General mobile-first wisdom**: minimum 48px touch targets (Apple HIG / Material), primary actions in the bottom thumb-zone, generous spacing between buttons (sweaty hands), haptic feedback (`navigator.vibrate(10)`) on every set logged.
## Alternatives Considered
| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Next.js 16 | Remix / React Router 7 | If you specifically wanted form-data-only progressive enhancement and no Vercel lock-in |
| Next.js 16 | TanStack Start | In 2027 once it's matured. Today it's too new for a single-dev no-time-to-debug app |
| Server Actions | tRPC | Only if you discover later that you need TanStack Query-style cache management on the client |
| Turso (libSQL) | Neon (Postgres) | If you decide you want JSONB columns, full-text-search via `pg_trgm`, or Postgres-only extensions |
| Turso (libSQL) | Cloudflare D1 | Only if you migrate hosting to Cloudflare Pages/Workers |
| Drizzle ORM 0.45.x | Drizzle ORM 1.0 beta | Once 1.0 cuts stable (likely Q3 2026); migration is a few days' work |
| Drizzle ORM | Prisma | Never for this app. Maybe if you had a non-TS team |
| React Hook Form | TanStack Form | If you specifically want framework-agnostic form lib (you don't — you're React-only) |
| Recharts | Visx | If you eventually want a custom chart type Recharts doesn't ship (e.g., a body-segment heatmap) |
| Recharts | Tremor | If you want pre-built dashboard layouts as one-liners. But Tremor bundles Recharts so it's strictly heavier |
| date-fns v4 | Temporal API | In 2027 when Node 26 ships it default-on |
| Vercel Hobby | Fly.io | If you ever need a long-running process (e.g., scheduled cron + persistent worker for InBody auto-fetch — you don't, since there's no InBody API) |
| Vercel Hobby | Railway | Same as Fly: only if you outgrow serverless |
| Vercel Hobby | Cloudflare Pages | If you commit fully to D1 + Workers and want bandwidth headroom |
| pnpm | Bun | When Bun's Windows + serverless story matures (it's improving) |
## What NOT to Use
| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **Pages Router** | Deprecated direction; App Router has been the recommended choice since Next 13. Server Actions and RSC unlock the form-heavy UX you need | App Router (default in Next 16) |
| **Prisma** | Heavy Rust query engine, slow serverless cold starts, schema-DSL that's less powerful than SQL itself | Drizzle |
| **Sequelize / TypeORM** | Decade-old, not TS-first, awkward async, low-leverage for new TS stacks | Drizzle |
| **MongoDB / Mongoose** | Wrong data model — your data (sets, sessions, exercises, scans) is fundamentally relational with hard joins | SQLite (Turso) + Drizzle |
| **Firebase / Firestore** | Vendor lock-in, awkward query model, pricing surprises at scale, no SQL | Turso |
| **NextAuth.js / Auth.js / Clerk / WorkOS** | You explicitly don't want auth. Adding any of these is over-engineering | The middleware pattern above (Layer 2) |
| **Redux / Zustand for global state** | Server Components + Server Actions handle most state. Use React's built-in `useState`/`useReducer` for in-session client state | RSC + Server Actions; React's built-ins for client |
| **TanStack Query (initially)** | You don't have client-side data fetching needs in v1 — RSC fetches on the server. Adding TQ now is premature | None until you discover a need (probably never for this app) |
| **Material UI / Chakra UI / Mantine / Ant Design** | Opinionated themes hard to customize for mobile-first one-handed UX; bundle weight; Tailwind v4 + shadcn gives more control | Tailwind + shadcn/ui |
| **Moment.js** | Mutable, unmaintained, huge bundle | date-fns |
| **csv-parse (low-level)** | More API surface for the same job; PapaParse handles InBody quirks better | PapaParse |
| **Chart.js + react-chartjs-2** | Canvas-based (harder to style with Tailwind), imperative-feeling React wrapper, weaker mobile touch UX than SVG | Recharts |
| **D3.js directly** | Massive learning curve, you'd be writing chart code instead of training-progress code | Recharts |
| **PWA / service worker / next-pwa** | Explicitly excluded in PROJECT.md ("Online-only"). Adds caching/sync/version-skew complexity for zero benefit at single-user gym scale | Just a responsive web app |
| **`tailwind.config.js` (v3-style config)** | v4 moved theming into CSS via `@theme` | `@theme { ... }` in your global CSS |
| **`drizzle-orm` 1.0-beta** | Active API churn, not worth it for a personal app you don't want to debug | `drizzle-orm` 0.45.x stable |
| **Cloudflare D1** | Locks you into Cloudflare runtime; libSQL is more portable | Turso (libSQL) |
| **Vercel Postgres / Neon** | Postgres is overkill; you don't use any Postgres-only features | Turso |
| **Bun runtime in production** | Vercel's Bun support is still tagged "experimental" for many features in May 2026; you won't gain anything for this app | Node.js (Vercel default) |
| **Yarn classic / Yarn berry / npm workspaces** | pnpm is faster, simpler, deterministic | pnpm |
## Stack Pattern: This Variant Specifically
- Use **Next.js + Server Actions** (zero API layer)
- Use **Turso + Drizzle** (smallest correct DB stack)
- Use **shadcn/ui + Tailwind v4** (mobile-first, themable, you own the code)
- Use **RHF + Zod** for the live-logging UI
- Use **Recharts** (shadcn integrates it)
- Use **PapaParse** for InBody CSV
- Deploy to **Vercel Hobby**
- Skip auth via **obscure URL + middleware basic auth** as Layer 2
- Move auth to a real provider (Auth.js with magic-link email is one new screen)
- Move DB to Neon Postgres (multi-tenancy via row-level scoping)
- Stay on Next.js — none of the rest needs to change
## Version Compatibility Notes
| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `next@16.1.6` | `react@19.2.3`, `react-dom@19.2.3` | Fixed peer; do not downgrade React |
| `next@16` | Node.js 20+ | Vercel uses 22 by default; fine |
| `tailwindcss@4` | `@tailwindcss/postcss@4` | Both required; v3-style config file is gone |
| `shadcn@3.5+` | `tailwindcss@4` | Use the `tailwind-v4` CLI flow; v3 components won't work as-is |
| `drizzle-orm@0.45.x` | `drizzle-kit@0.31.x` | Keep both on the same minor train |
| `drizzle-orm/libsql` | `@libsql/client@0.14+` | The libSQL driver |
| `react-hook-form@7.66` | `react@19` | Confirmed working |
| `@hookform/resolvers` | `zod@4` | Use the v4-compatible resolver entry point |
| `recharts@3.3` | `react@19` | v3 is the React-19-supporting line; v2 was React 16-18 |
## Sources
| Source | What was verified | Confidence |
|--------|-------------------|------------|
| Context7 `/vercel/next.js` | Next.js 16, App Router, Server Actions, current versions | HIGH |
| Context7 `/drizzle-team/drizzle-orm` | Drizzle SQLite/libSQL connector syntax, current version line | HIGH |
| Context7 `/shadcn-ui/ui` | Tailwind v4 dependency set, init CLI, components.json | HIGH |
| Context7 `/recharts/recharts` | Recharts v3, React 19 compatibility | HIGH |
| Context7 `/colinhacks/zod` | Zod 4 stable, install paths | HIGH |
| Context7 `/tursodatabase/libsql` | libSQL remote/embedded usage | HIGH |
| [Next.js 16 release blog](https://nextjs.org/blog/next-16) | Turbopack default, stable signals | HIGH |
| [Next.js 16.1 release blog](https://nextjs.org/blog/next-16-1) | Turbopack FS caching, latest stable | HIGH |
| [Vercel Hobby Plan docs](https://vercel.com/docs/plans/hobby) | Free tier limits, non-commercial restriction, deployment protection | HIGH |
| [Vercel Limits](https://vercel.com/docs/limits) | 100GB bandwidth, function invocations | HIGH |
| [Tailwind CSS v4 release](https://tailwindcss.com/blog/tailwindcss-v4) | v4 install with PostCSS plugin, CSS-first config | HIGH |
| [Turso Pricing](https://turso.tech/pricing) | 5GB free / 500M reads / 100 DBs | HIGH |
| [Drizzle ORM releases](https://orm.drizzle.team/docs/latest-releases) | 0.45.x stable, 1.0-beta in progress | HIGH |
| [npm `drizzle-orm`](https://www.npmjs.com/package/drizzle-orm) | Latest published version timestamp | HIGH |
| [Recharts vs Tremor vs Visx 2026 comparison](https://www.pkgpulse.com/guides/recharts-v3-vs-tremor-vs-nivo-react-charting-2026) | Bundle sizes, React 19 support | MEDIUM |
| [date-fns v4 vs Temporal vs Day.js 2026](https://www.pkgpulse.com/guides/date-fns-v4-vs-temporal-api-vs-dayjs-date-handling-2026) | TC39 Stage 4, polyfill size, Node version status | MEDIUM |
| [Server Actions vs tRPC 2026 architect's guide](https://medium.com/@factman60/next-js-server-actions-vs-trpc-a-2026-architects-guide-85cc4953bae4) | When each is appropriate | MEDIUM |
| [Vercel basic-auth template](https://vercel.com/templates/next.js/basic-auth-password) | Middleware HTTP Basic Auth pattern | HIGH |
| [Mobile UX 2026 best practices](https://www.designstudiouiux.com/blog/mobile-navigation-ux/) | Touch target sizing, thumb-zone, navigation patterns | MEDIUM |
| [shadcn/ui Tailwind v4 docs](https://ui.shadcn.com/docs/tailwind-v4) | Reference app stack (Next 16.1.6, React 19.2.3, Tailwind v4) | HIGH |
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
