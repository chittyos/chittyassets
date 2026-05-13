---
uri: chittycanon://core/services/chittyassets
tier: 4
certification: BRONZE
status: PENDING
migration_status: MIGRATING_EXPRESS_TO_HONO
organization: CHITTYOS
---

# ChittyAssets — CHITTY

## Ecosystem Position

```
LAYER 4 — DOMAIN (Business Logic)

chittycanon://core/services/chittyassets
```

ChittyAssets is a Tier 4 Domain service. It consumes identity (ChittyID), trust (ChittyTrust), authentication (ChittyAuth), schema validation (ChittySchema), and blockchain anchoring (ChittyChain) from lower tiers, and produces ownership-verified asset records consumed by legal, insurance, and reporting services at Tier 5+.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Cloudflare Workers (migrating from Node.js 20 / Express 4 → Hono) |
| Deploy target | Cloudflare Workers (`chittyassets-api` / `chittyassets-api-prod`) |
| Frontend | React 18, Vite 7, Wouter, TanStack Query, Radix UI, Tailwind CSS 3 |
| Backend | Express 4, TypeScript 5.6, Drizzle ORM 0.39 |
| Database | Neon PostgreSQL (project: `steep-cloud-28172078`, org: Chitty(OS/APPS)Central) |
| Secret store | 1Password (`op://synthetic-shared/NEON_DB_CHITTYASSETS/credential`) |
| File storage | Google Cloud Storage (ACL-enforced, private evidence files) |
| AI | OpenAI GPT-4o (document analysis, valuation, legal document generation) |
| Auth middleware | ChittyAuth JWT (`auth.chitty.cc`) |
| Schema | Drizzle-Zod shared types in `/shared/schema.ts` |
| Package | `@chittyos/chittyassets` v1.0.0 |

---

## Architecture

```
Browser / Mobile Client
        |
  React SPA (Vite)
        |
   Express API (Node.js)
        |
  ┌─────────────────────────────────────┐
  │  chittyAuth.ts   →  auth.chitty.cc  │  JWT validation
  │  chittyCore.ts   →  id.chitty.cc    │  ChittyID generation
  │                  →  trust.chitty.cc │  Trust scoring
  │                  →  chain.chitty.cc │  Blockchain freeze/mint
  │                  →  ledger.chitty.cc│  Evidence ledger
  │  aiAnalysis.ts   →  OpenAI GPT-4o  │  AI document analysis
  │  objectStorage.ts→  Google Cloud    │  Evidence file ACL
  │  storage.ts      →  Neon PostgreSQL │  Structured data
  └─────────────────────────────────────┘
        |
  Cloudflare Worker (chittyassets-api-prod)
```

### Key Modules

| Module | Path | Responsibility |
|--------|------|---------------|
| Route definitions | `server/routes.ts` | All API endpoints, auth middleware binding |
| ChittyOS core client | `server/chittyCore.ts` | Unified client for id/trust/chain/ledger services |
| ChittyAuth middleware | `server/chittyAuth.ts` | JWT validation against auth.chitty.cc |
| AI analysis | `server/aiAnalysis.ts` | GPT-4o receipt, document, valuation, legal doc generation |
| Object storage | `server/objectStorage.ts` | GCS signed URLs, ACL policy enforcement |
| Database layer | `server/storage.ts` | Drizzle ORM abstraction for all DB operations |
| Shared schema | `shared/schema.ts` | Zod + Drizzle schema shared by client and server |
| GitHub webhooks | `server/githubWebhooks.ts` | GitHub App event handling |
| Tool registry | `server/toolRegistry.ts` | Agent-accessible connector surface |

---

## Consumers

Services and actors that consume ChittyAssets:

| Consumer | What they consume |
|----------|------------------|
| End users (browser/mobile) | React SPA — asset dashboard, evidence upload, AI analysis |
| ChittyChronicle | Audit event stream (timeline events written by assets service) |
| ChittyEvidence (legal) | Evidence records submitted to `ledger.chitty.cc` for legal case use |
| Agent layer / ChittyHelper | Tool resources via `/api/tools/resources` |
| ChittyScore | Asset trust scores fed into reputation calculations |

---

## Asset Lifecycle State Machine

```
DRAFT  →  (freeze)  →  FROZEN  →  (7 days elapsed)  →  (mint)  →  MINTED
  |                       |
  |                  Evidence/AI
  |                  analysis window
  |
  (delete) → removed
```

- **DRAFT**: Asset created, ChittyID assigned, trust score calculated. Evidence can be added, AI analysis can run.
- **FROZEN**: `POST /api/assets/:id/freeze` called. ChittyChain records freeze timestamp, IPFS hash assigned. 7-day immutability period begins.
- **MINTED**: After 7-day period, `POST /api/assets/:id/mint` creates evidence token on ChittyChain. `blockchainHash` and `mintingFee` recorded.

---

## Evidence Compliance

- **Legal standard**: Federal Rules of Evidence (FRE), USA Federal jurisdiction
- **Retention**: 2555 days (7 years)
- **Encryption at rest**: AES-256-GCM (configured via `.env.chittyos`)
- **Chain of custody**: All state transitions written as timeline events — immutable append
- **Digital signatures**: Required (configured via `.env.chittyos`: `CHITTY_DIGITAL_SIGNATURE_REQUIRED=true`)

---

## Certification Level

**BRONZE** (starting level — pending full registration and compliance sign-off)

Bronze criteria met:
- ChittyAuth integration (in progress — uncommitted branch)
- ChittyID calls for asset identity generation
- ChittyTrust calls for trust scoring
- Neon PostgreSQL provisioned (project `steep-cloud-28172078`)
- Evidence ledger integration (`ledger.chitty.cc`)

Bronze criteria NOT yet met (blockers for Silver):
- `/health` endpoint not present in routes (mandatory compliance endpoint)
- `/api/v1/status` endpoint not present in routes (mandatory compliance endpoint)
- `wrangler.toml` stale compat date (`2024-01-01`)
- Missing `[[hyperdrive]]` binding for Neon
- Missing `[[tail_consumers]]` for ChittyChronicle / ChittyTrack
- Not registered in ChittyCanon

---

## Deployment

```bash
# Development
npm run dev            # Vite + Express hot reload

# Build
npm run build          # Vite frontend + esbuild server bundle

# Deploy to Cloudflare
npx wrangler deploy --env production

# Health check post-deploy
curl -s https://chittyassets-api-prod.workers.dev/health | jq .

# Database schema push
npm run db:push
```

Secrets are injected via 1Password:
```bash
op run --env-file=.env.chittyos -- npm run dev
```

---

## Known Gaps (Wrangler / Infra)

These are flagged in CHARTER.md and must be resolved before Silver certification:

1. `compatibility_date = "2024-01-01"` — update to `2025-01-01` minimum
2. No `[[hyperdrive]]` block — add Neon Hyperdrive binding for pooled connections in Worker
3. No `[[tail_consumers]]` — add ChittyChronicle and ChittyTrack tail consumer bindings
4. KV and D1 blocks are commented out — confirm not needed or add with real IDs
