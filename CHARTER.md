---
uri: chittycanon://docs/ops/policy/chittyassets-charter
namespace: chittycanon://docs/ops
type: policy
version: 1.0.0
status: PENDING
registered_with: null
title: "ChittyAssets Charter"
certifier: chittycanon://core/services/chittycertify
visibility: PUBLIC
service_uri: chittycanon://core/services/chittyassets
---

# ChittyAssets — CHARTER

## Classification

- **Canonical URI**: `chittycanon://core/services/chittyassets`
- **Tier**: 4 (Domain — Business Logic)
- **Organization**: CHITTYOS
- **Primary URL**: assets.chitty.cc (target) / chittyassets-api-prod (Cloudflare Worker)
- **Repo**: `CHITTYOS/chittyassets`
- **Status**: MIGRATING (Express → Hono on Cloudflare Workers)
- **Entity types handled**: P (Person — users), L (Location — jurisdictions referenced on legal cases), T (Thing — assets, evidence files, warranty contracts, insurance policies), E (Event — timeline events, freeze, mint, legal proceedings), A (Authority — referenced credential issuers, courts, certifying authorities)

## Mission

Provide a blockchain-anchored asset ownership registry and evidence ledger for the ChittyOS ecosystem. ChittyAssets registers physical and digital assets, attaches AI-verified evidence, enforces a 7-day immutability freeze before blockchain finalization, and exposes ownership proofs consumable by downstream legal and insurance services.

---

## Scope

### This Service IS Responsible For

- Asset CRUD — create, read, update, delete assets scoped to a ChittyID-authenticated user
- Evidence attachment — file upload (Google Cloud Storage), ACL enforcement, and evidence lifecycle per asset
- AI analysis — GPT-4o document analysis: receipt parsing, asset valuation, trust score calculation
- Blockchain integration — ChittyChain freeze (7-day) and mint (evidence token) workflows
- Evidence ledger — submitting, retrieving, and verifying evidence via `chittycanon://core/services/evidence` (ledger.chitty.cc)
- Legal document generation — AI-drafted ownership certificates, chain of custody reports
- Warranty and insurance tracking — expiry alerting, per-asset policy management
- Timeline event recording — immutable audit trail of all asset lifecycle events
- Ecosystem health surface — `/api/ecosystem/status` aggregating upstream service states

### This Service IS NOT Responsible For

- ChittyID minting (→ `chittycanon://core/services/identity`)
- Certificate signing (→ `chittycanon://core/services/cert`)
- User authentication token issuance (→ `chittycanon://core/services/auth`)
- Canonical URI assignment (→ `chittycanon://core/services/canon`)
- Schema governance (→ `chittycanon://core/services/schema`)
- Audit log immutability (→ `chittycanon://core/services/chronicle`)
- Service mesh binding (→ `chittycanon://core/services/discovery`)
- Trust score algorithm governance (→ `trust.chitty.cc`)
- Semantic memory persistence (→ `chittycanon://core/services/connect`)

---

## Dependencies

| Direction | Service | Canonical URI | Purpose |
|-----------|---------|---------------|---------|
| Upstream | ChittyAuth | `chittycanon://core/services/auth` | JWT authentication via auth.chitty.cc |
| Upstream | ChittyID | `chittycanon://core/services/identity` | ChittyID generation for assets (id.chitty.cc) |
| Upstream | ChittyTrust | `chittycanon://core/services/trust` | Trust score calculation (trust.chitty.cc) |
| Upstream | ChittySchema | `chittycanon://core/services/schema` | Schema validation for evidence payloads (schema.chitty.cc) |
| Upstream | ChittyChain | `chittycanon://core/services/chain` | Blockchain freeze and mint (chain.chitty.cc) |
| Upstream | ChittyEvidence | `chittycanon://core/services/evidence` | Evidence ledger submit/verify (ledger.chitty.cc) |
| Upstream | Neon PostgreSQL | (Neon project steep-cloud-28172078) | Structured data: assets, evidence, timeline, warranties |
| Upstream | Google Cloud Storage | (external) | Binary evidence file storage |
| Upstream | OpenAI GPT-4o | (external) | AI document analysis and valuation |
| Downstream | ChittyChronicle | `chittycanon://core/services/chronicle` | Audit event logging (non-blocking) |
| Downstream | ChittyDiscovery | `chittycanon://core/services/discovery` | Service mesh registration (non-blocking) |
| Peer | ChittyScore | `chittyscore` | Evidence weight and reputation scoring |

---

## API Contract

All routes except `/health` and `/api/v1/status` require a valid ChittyAuth JWT (`Authorization: Bearer <token>` or session cookie set by `auth.chitty.cc`).

### Compliance Endpoints (Required)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | None | Health check — returns `{"status":"ok","service":"chittyassets"}` |
| GET | `/api/v1/status` | None | Service status and version |

### Auth Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/auth/user` | JWT | Fetch authenticated user record |

### Asset Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/assets` | JWT | List user assets with filters (`type`, `status`, `search`, `minValue`, `maxValue`) |
| POST | `/api/assets` | JWT | Create asset — generates ChittyID, calculates initial trust score |
| GET | `/api/assets/stats` | JWT | Aggregate portfolio statistics |
| GET | `/api/assets/:id` | JWT | Fetch single asset |
| PUT | `/api/assets/:id` | JWT | Update asset fields |
| DELETE | `/api/assets/:id` | JWT | Delete asset |
| POST | `/api/assets/:id/freeze` | JWT | Initiate 7-day ChittyChain immutability freeze |
| POST | `/api/assets/:id/mint` | JWT | Mint evidence token (requires frozen status) |
| POST | `/api/assets/:assetId/calculate-trust-score` | JWT | Recalculate trust score via AI analysis |

### Evidence Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/assets/:assetId/evidence` | JWT | List evidence for asset |
| POST | `/api/assets/:assetId/evidence` | JWT | Attach evidence record |
| POST | `/api/evidence/:evidenceId/analyze` | JWT | GPT-4o analysis (`receipt`, `document`, `asset_valuation`) |

### Evidence Ledger Routes (ChittyOS Ecosystem)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/evidence-ledger/submit` | JWT | Submit evidence to ChittyOS ledger at ledger.chitty.cc |
| GET | `/api/evidence-ledger/:chittyId` | JWT | Retrieve evidence by ChittyID from ledger |
| POST | `/api/evidence-ledger/:chittyId/verify` | JWT | Verify evidence authenticity |

### Warranty Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/assets/:assetId/warranties` | JWT | List warranties for asset |
| POST | `/api/assets/:assetId/warranties` | JWT | Create warranty record |
| GET | `/api/warranties/expiring` | JWT | Expiring warranties (query: `days`, default 30) |

### Insurance Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/assets/:assetId/insurance` | JWT | List insurance policies for asset |
| POST | `/api/assets/:assetId/insurance` | JWT | Attach insurance policy |

### Legal Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/legal-cases` | JWT | List user legal cases |
| POST | `/api/legal-cases` | JWT | Create legal case |
| POST | `/api/legal/generate-document` | JWT | AI-generate legal ownership document |

### Timeline Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/assets/:assetId/timeline` | JWT | Asset lifecycle event timeline |

### Object Storage Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/objects/:objectPath` | JWT | Stream evidence file (ACL-enforced) |
| POST | `/api/objects/upload` | JWT | Get signed GCS upload URL |
| PUT | `/api/evidence-files` | JWT | Set ACL policy for uploaded evidence file |

### Ecosystem Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/ecosystem/status` | JWT | Aggregated health of all ChittyOS upstream services |
| GET | `/api/tools/resources` | JWT | List tool/connector resources available to agent layer |
| POST | `/api/seed-demo` | JWT | Seed demo assets for onboarded user |

---

## Schema Summary

Core entities (Neon PostgreSQL, Drizzle ORM):

- `users` — ChittyID-anchored user records
- `assets` — Asset registry with `chittyId`, `trustScore`, `chittyChainStatus` (`draft` | `frozen` | `minted`), `ipfsHash`, `blockchainHash`
- `evidence` — Evidence files linked to assets; includes `verificationStatus`, `aiAnalysis`
- `aiAnalysisResults` — GPT-4o output records: `analysisType`, `confidence`, `results`, `processingTime`, `modelUsed`
- `timelineEvents` — Immutable event log per asset
- `warranties` — Warranty policies linked to assets
- `insurancePolicies` — Insurance records linked to assets
- `legalCases` — Legal case records linked to users

---

## Security

- **Authentication**: JWT via ChittyAuth (`auth.chitty.cc`). Middleware: `requireChittyAuth()` on all protected routes.
- **Encryption**: TLS in transit (Cloudflare termination); AES-256-GCM for evidence data at rest (per `.env.chittyos` policy).
- **File ACL**: Evidence files private by default; per-object ACL enforced via `ObjectPermission.READ` check before any stream.
- **Evidence retention**: 7-year retention (2555 days) for legal compliance (FRE / USA Federal).
- **Chain of custody**: Strict — all state transitions recorded as immutable timeline events.

---

## Compliance Flags (Known Issues — Not Yet Fixed)

The following items are flagged for remediation prior to production certification. Do not fix inline — treat as a follow-up checklist:

1. **Stale `wrangler.toml` compat date**: `compatibility_date = "2024-01-01"` should be `2025-01-01` (or current). Stale compat dates suppress runtime flag updates and can expose Workers to deprecated API behavior.
2. **Missing Hyperdrive binding**: Neon PostgreSQL is accessed via `@neondatabase/serverless` directly. For production Worker deployments, add a `[[hyperdrive]]` binding in `wrangler.toml` to use Cloudflare's connection pooling. Connection pooling over direct TCP from a Worker is unreliable under load.
3. **Missing `tail_consumers`**: No `[[tail_consumers]]` block in `wrangler.toml`. ChittyChronicle and ChittyTrack observability rely on tail consumers for real-time audit streaming. Add `[[tail_consumers]]` binding pointing to `chittychronicle` and `chittytrack` Workers.
4. **Auth migration incomplete**: `CLAUDE.md` references Replit Auth (Passport.js / OpenID Connect). Code uses ChittyAuth (`requireChittyAuth()`). Confirm Replit Auth is fully replaced before certifying.
5. **Health and status endpoints**: `/health` and `/api/v1/status` routes are not yet visible in `routes.ts`. These are mandatory for registration. They must be added before the POST to ChittyRegister.

---

## Ownership

- **Maintainer**: @chittyos/assets
- **Escalation**: assets@chitty.cc
- **Repo**: `https://github.com/chittyos/chittyassets`

---

## Related Files

| File | Purpose |
|------|---------|
| `CHARTER.md` | What this service IS — governance, scope, API contract |
| `CHITTY.md` | Where this service sits — architecture, ecosystem position |
| `CLAUDE.md` | How to WORK with this service — dev commands, patterns |
| `register.json` | Registration payload for ChittyRegister |
