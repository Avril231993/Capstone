# RegiSync — Intelligent Class Scheduling and Faculty Loading System

## Run & Operate
- `pnpm --filter @workspace/api-server run dev` — run API server
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-spec run codegen` — regenerate hooks + Zod schemas from OpenAPI spec
- `pnpm run typecheck` — full typecheck across all packages
- Required env vars: `DATABASE_URL`, `SESSION_SECRET`, `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY`

## Stack
- **Monorepo**: pnpm workspaces, Node.js 24, TypeScript 5.9
- **Frontend**: React 18 + Vite, Wouter routing, TanStack Query, shadcn/ui, Tailwind CSS
- **Backend**: Express 5, Drizzle ORM, PostgreSQL
- **AI**: Replit OpenAI integration (`@workspace/integrations-openai-ai-server`) — no API key needed
- **API contracts**: OpenAPI → Orval codegen (Zod schemas + React Query hooks)
- **Validation**: `zod` (server routes), `drizzle-zod` (DB schemas)

## Where things live
- `lib/db/src/schema/` — DB schemas (one file per table); barrel at `index.ts`
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for all endpoints)
- `lib/api-client-react/src/generated/` — generated React Query hooks
- `lib/api-zod/src/generated/` — generated Zod schemas
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/scheduler/src/pages/` — React page components
- `artifacts/scheduler/src/components/layout.tsx` — sidebar nav (grouped)

## Architecture decisions
- Contract-first API: edit OpenAPI spec, run codegen, then implement routes — never the reverse
- `zod/v4` subpath not resolvable by esbuild; server routes must import from `"zod"` directly
- `@workspace/integrations-openai-ai-server` exports `{ openai }` as named export (not default)
- Integration libs (`integrations-openai-ai-*`) are NOT in root `tsconfig.json` references — they use direct source exports via package.json `exports` field
- DB schema uses cascade deletes: sections cascade from year levels, year levels optionally cascade from school years

## Product
- **Dashboard**: overview stats and recent schedules
- **Timetable**: color-coded grid with department filters, CSV export, print
- **Schedule Builder**: drag-and-drop assignment with conflict detection
- **School Years**: lifecycle management — create, archive, initialize next year
- **Year Levels & Sections**: auto-generate sections (A, B, C…) when creating a year level
- **LOI Processing**: paste/upload LOI text → GPT-4o-mini extracts availability + specializations → apply to faculty profile
- **Faculty Specializations**: per-faculty subject area tagging with primary/secondary designation
- **Faculty Availability**: day/time-of-day matrix, sourced from LOI or set manually
- **Reports**: faculty load and room utilization
- **AI Suggestions & Conflicts**: schedule optimization and conflict detection

## Gotchas
- After editing `openapi.yaml`, run codegen before touching frontend hooks
- Server must import `zod` (not `zod/v4`) — esbuild bundler limitation
- New DB tables require `pnpm --filter @workspace/db run push` after schema edits
- Seeded data uses "1st Semester" / "2025-2026" as default semester/year throughout
