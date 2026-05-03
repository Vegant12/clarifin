# Clarifin

Make IDX financial documents understandable in plain English to investors who don't speak finance.

## Prerequisites

- Node 20+
- pnpm 9+
- Docker Desktop (running)
- Supabase CLI 1.190+ (`brew install supabase/tap/supabase` or use the pinned `pnpm exec supabase`)

## Setup

1. `pnpm install`
2. Copy `.env.example` to `.env.local` and fill values
3. `pnpm db:start` — starts local Supabase (Postgres + Storage + Studio)
4. `pnpm db:reset` — applies migrations
5. `pnpm db:types` — generates TypeScript types from local DB
6. `pnpm dev` — starts Next.js at http://localhost:3000

## Scripts

- `pnpm dev` — Next.js dev server
- `pnpm build` — production build
- `pnpm typecheck` — TS strict check
- `pnpm lint` — Biome lint
- `pnpm test` — Vitest run
- `pnpm db:reset` — recreate local DB from migrations

## Planning

Implementation is driven by `.planning/`. See `.planning/ROADMAP.md` for phase order.
