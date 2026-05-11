# AGENTS.md — ChittyAssets

Agent registry and working instructions for AI agents operating on this repository.

**Service**: `chittycanon://core/services/chittyassets`
**Repo**: `CHITTYOS/chittyassets`
**Tier**: 4 (Domain — asset ownership verification, evidence pipeline, blockchain integration)
**Stack**: React 18 + Express 4 + Drizzle ORM + Neon PostgreSQL + GCS + ChittyChain + GPT-4o + ChittyAuth

Read the Compliance Triad before making substantive changes:
- `CHARTER.md` — API contract, scope boundaries, dependency table, compliance flags
- `CHITTY.md` — Architecture, module map, asset lifecycle state machine, certification level
- `CLAUDE.md` — Dev commands, Drizzle patterns, integration gotchas

---

## Common Commands

```bash
npm run dev          # Vite frontend + Express backend with hot reload
npm run build        # Production build (Vite frontend + server bundle)
npm start            # Run production server
npm run db:push      # Push Drizzle schema changes to Neon (steep-cloud-28172078)
npm run check        # TypeScript type checking (client + server)
```

Secrets are managed via 1Password — never hardcode:
```bash
op run --env-file=.env.chittyos -- npm run dev
```

Deploy to Cloudflare:
```bash
npx wrangler deploy --env production
curl -s https://chittyassets-api-prod.workers.dev/health | jq .
```

---

## Architecture Quick Reference

```
Browser / Mobile
    React SPA (Vite, Wouter, TanStack Query, Radix UI)
        |
    Express API (Node.js 20)
        |
    ┌──────────────────────────────────────────────┐
    │  chittyAuth.ts      →  auth.chitty.cc        │
    │  chittyCore.ts      →  id.chitty.cc          │
    │                     →  trust.chitty.cc       │
    │                     →  chain.chitty.cc       │
    │                     →  ledger.chitty.cc      │
    │  aiAnalysis.ts      →  OpenAI GPT-4o         │
    │  objectStorage.ts   →  Google Cloud Storage  │
    │  storage.ts         →  Neon PostgreSQL        │
    └──────────────────────────────────────────────┘
        |
    Cloudflare Worker (chittyassets-api-prod)
```

**Key source files:**

| File | Responsibility |
|------|---------------|
| `server/routes.ts` | All API endpoints, middleware binding |
| `server/chittyAuth.ts` | JWT validation against auth.chitty.cc |
| `server/chittyCore.ts` | Unified client for ChittyOS upstream services |
| `server/aiAnalysis.ts` | GPT-4o analysis (receipt, document, valuation, legal) |
| `server/objectStorage.ts` | GCS signed URLs and ACL policy enforcement |
| `server/storage.ts` | Drizzle ORM abstraction for all DB operations |
| `shared/schema.ts` | Zod + Drizzle schemas shared by client and server |
| `server/githubWebhooks.ts` | GitHub App event handling |
| `server/toolRegistry.ts` | Agent-accessible connector surface |

---

## Asset Lifecycle State Machine

```
DRAFT  →  (freeze)  →  FROZEN  →  (7 days)  →  (mint)  →  MINTED
  |                       |
  |                  Evidence/AI analysis window
  |
  (delete) → removed
```

State transitions are gated in `server/routes.ts`. All transitions write immutable `timelineEvents` records. Agents must not skip state machine steps — no direct DB writes that bypass the route layer.

---

## Database Schema (Neon — `steep-cloud-28172078`)

Core tables (Drizzle ORM, `shared/schema.ts`):

- `users` — ChittyID-anchored user records
- `assets` — Asset registry: `chittyId`, `trustScore`, `chittyChainStatus` (draft/frozen/minted), `ipfsHash`, `blockchainHash`
- `evidence` — Evidence files linked to assets: `verificationStatus`, `aiAnalysis`
- `aiAnalysisResults` — GPT-4o output: `analysisType`, `confidence`, `results`, `processingTime`, `modelUsed`
- `timelineEvents` — Immutable append-only event log per asset
- `warranties` — Warranty policies per asset
- `insurancePolicies` — Insurance records per asset
- `legalCases` — Legal case records per user

Always run `npm run db:push` after schema changes. Validate the SQL against the real Neon project before committing — no placeholder migrations.

---

## Integration Patterns

### ChittyAuth JWT

All protected routes use `requireChittyAuth()` middleware from `server/chittyAuth.ts`. The middleware validates JWTs issued by `auth.chitty.cc`. Do not add custom auth bypasses or fallback token logic — route through ChittyAuth.

### ChittyOS Core Services (chittyCore.ts)

Calls to `id.chitty.cc`, `trust.chitty.cc`, `chain.chitty.cc`, and `ledger.chitty.cc` are centralized in `server/chittyCore.ts`. Add new upstream calls here — do not scatter direct `fetch()` calls to ChittyOS services across route handlers.

### GPT-4o Evidence Analysis

`server/aiAnalysis.ts` accepts an enumerated `analysisType` (`receipt` | `document` | `asset_valuation`). Results are stored as structured JSON in `aiAnalysisResults`. Do not change the schema of stored results without updating the Drizzle schema and re-validating existing records.

### GCS File Access

All evidence file access flows through `server/objectStorage.ts`. The ACL check (`ObjectPermission.READ`) must run before any GCS stream is returned. Never add a route that proxies GCS objects without going through this module.

### Evidence Ledger

Submissions to `ledger.chitty.cc` (`POST /api/evidence-ledger/submit`) must include the evidence ChittyID. Read the `chittycanon://core/services/evidence` CHARTER.md before extending this integration.

---

## Coding Standards

- Language: TypeScript (strict mode). Indentation: 2 spaces.
- Filenames: `camelCase.ts` for server modules; `PascalCase.tsx` for React components.
- Schemas: Define in `shared/schema.ts` (Zod + Drizzle). Client and server share these — changes affect both.
- No mock data, fake data, or placeholder endpoints — see global CLAUDE.md policy.
- No `vi.mock()` / `jest.mock()` on DB or service modules in new tests. Tests hit real Neon branches.
- Every new route must have a corresponding real query against Neon before commit.

---

## Testing

Framework: Vitest (`vitest.config.ts`). Tests live under `test/`.

```bash
npm test             # Run full test suite
```

For Neon-backed tests: use the `steep-cloud-28172078` project on a dev branch. Never mock the DB layer in new test files.

---

## Security Rules for Agents

1. Do not commit secrets, API keys, or DB connection strings. All secrets via 1Password (`op run`).
2. Do not add a GCS streaming route without ACL enforcement via `objectStorage.ts`.
3. Do not modify `timelineEvents` records — this table is append-only.
4. Do not bypass `requireChittyAuth()` middleware on any route.
5. Do not send raw user input to GPT-4o without the enumerated `analysisType` gating in `aiAnalysis.ts`.
6. Evidence files have a 7-year retention minimum (FRE compliance) — do not add delete paths for evidence.
7. Before extending the evidence ledger integration, read the CHARTER.md of `chittycanon://core/services/evidence`.

---

## Compliance Flags (Open — Do Not Fix Inline)

These items require coordinated remediation — flag them in PRs but do not patch inline without a tracked issue:

1. `wrangler.toml` `compatibility_date = "2024-01-01"` — update to `2025-01-01` minimum
2. Missing `[[hyperdrive]]` binding — Neon needs Cloudflare Hyperdrive for Worker deployments
3. Missing `[[tail_consumers]]` — ChittyChronicle and ChittyTrack audit streaming not wired
4. Replit Auth references in `CLAUDE.md` — confirm full replacement by ChittyAuth before Silver certification
5. `/health` and `/api/v1/status` endpoints — not yet present in `routes.ts`; mandatory before ChittyRegister submission

---

## PR Requirements

- Every PR must pass `npm run check` (TypeScript) and `npm test`.
- Routes touching the evidence or blockchain pipeline require a test against the real Neon dev branch.
- PRs that extend ChittyOS upstream integrations must reference the upstream service's CHARTER.md in the PR description.
- Do not merge PRs with open compliance flags from the list above without a linked tracking issue.

---

## Capability Registration Note

Do not add MCP servers, tools, or skills to local client configuration. New capabilities for this service route through Ch1tty's backend per the global CLAUDE.md capability registration policy. See `server/toolRegistry.ts` for the agent-accessible connector surface.
