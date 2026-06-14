# Orgonite Chat Node.js

## Règle absolue
Chaque modification doit être commitée et **pushée sur GitHub** immédiatement. Hostinger déploie automatiquement depuis `main`. Si ce n'est pas pushé, ce n'est pas déployé.

## Stack
- **Frontend**: React 19 + Vite + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Node.js + Express + TypeScript
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **AI**: Gemini API with SSE streaming
- **CI/CD**: GitHub Actions
- **Infra**: Docker Compose

## Project structure
```
orgonite-chat-node/
├── client/          # React SPA (chat + admin)
├── server/          # Express API
├── packages/shared/ # Shared TypeScript types
├── supabase/        # Migrations & seeds
└── docker/          # Docker configs
```

## Commands
| Command | Description |
|---|---|
| `npm run dev` | Start client + server concurrently |
| `npm run build` | Build all packages |
| `npm run lint` | Lint all packages |
| `npm run test` | Run all tests |
| `npm run typecheck` | TypeScript check all packages |

## Environment variables
Copy `.env.example` to `.env` and fill in:
- `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` / `VITE_SUPABASE_ANON_KEY`
- `GEMINI_API_KEYS` / `GEMINI_MODELS`
- `ADMIN_PASSWORD` (fallback if Supabase Auth not used)

## Supabase setup
1. Create project at https://supabase.com
2. Run migrations in `supabase/migrations/`
3. Copy project URL + anon key + service key to `.env`

## Migrating from PHP
- Schema: `supabase/migrations/001_initial_schema.sql` (ported from `schema.sql`)
- Data: Use Supabase SQL editor to import existing data from MySQL dump
