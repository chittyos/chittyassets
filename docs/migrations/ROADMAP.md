---
uri: chittycanon://docs/tech/spec/chittyassets-migration-roadmap
namespace: chittycanon://docs/tech
type: spec
version: 1.0.0
status: DRAFT
registered_with: chittycanon://core/services/canon
title: ChittyAssets Express → Hono Migration Roadmap
author: chittycanon-code-cardinal
visibility: INTERNAL
tags: [migration, hono, cloudflare-workers, chittyassets]
category: migration
@canon: chittycanon://core/services/chittyassets
---

# ChittyAssets Migration Roadmap

Source-of-truth route inventory: `server/routes.ts` (673 lines). This document is the
index for the Express → Cloudflare Workers (Hono) migration. Each phase has a
dedicated plan under `docs/migrations/`.

## Canonical posture

- **Service**: `chittycanon://core/services/chittyassets`
- **Tier**: 4 (Domain)
- **Entity types handled**: P (Person), L (Location), T (Thing), E (Event), A (Authority) — all five P/L/T/E/A
- **Primary Thing (T)**: `asset` (the ChittyAsset itself)
- **Primary Event (E)**: `timeline_event` (asset lifecycle: created, frozen, minted, evidence_added)
- **Primary Authority (A)**: evidence trust score + ChittyChain mint receipt
- **Person (P)**: asset owner (`userId` from ChittyAuth, `chitty_${auth.userId}`)
- **Location (L)**: jurisdiction on legal_case, asset physical location metadata

## Dependency graph

```
chittyassets (Tier 4)
  ├─ chittyauth        (Tier 1) — JWKS verify, Person principal
  ├─ chittyid          (Tier 0) — chittyId mint for new assets
  ├─ chittytrust       (Tier 0) — trust score on create
  ├─ chittyledger      (Tier 4) — evidence ledger submit/verify
  ├─ chittymint        (Tier 4) — ChittyChain freeze/mint
  ├─ openai (external) — document analysis, legal-doc generation
  ├─ Neon Postgres     — via Hyperdrive binding CHITTYASSETS_DB
  └─ R2 bucket         — evidence files (replaces GCS)
```

## Phase status

| Phase | Branch | PR | Status |
|------|--------|----|--------|
| 0 — canonical artifacts (CHARTER, CHITTY, AGENTS, SECURITY, register.json) | `feat/hono-migration-phase-1` | #33 | OPEN |
| 1 — Hono Worker skeleton (`/health`, `/api/v1/status`, `/api/auth/user`, JWKS) | `feat/hono-migration-phase-1` | #33 | OPEN |
| Schema remediation — `chitty_id`, P/L/T/E/A enum, `entities` registry, `r2_object_acl` (Drizzle migration `0003`) | `chore/schema-canonical-remediation` | #34 | OPEN |
| 2a — asset reads (`GET /api/assets`, `/:id`, `/stats`, `/:id/evidence`, `/:id/timeline`) | `feat/hono-phase-2a-asset-reads` | in flight | IN PROGRESS |
| 2b — simple reads (warranties, insurance, legal-cases, tools/resources) | `feat/hono-phase-2b-simple-reads` (planned) | — | PLANNED → see [phase2b-simple-reads.md](./phase2b-simple-reads.md) |
| 2c — external reads (evidence-ledger get, ecosystem/status) | `feat/hono-phase-2c-external-reads` (planned) | — | PLANNED → see [phase2c-external-reads.md](./phase2c-external-reads.md) |
| 3a — asset writes (POST/PUT/DELETE `/api/assets`, evidence create) | `feat/hono-phase-3a-asset-writes` (planned) | — | PLANNED → see [phase3a-asset-writes.md](./phase3a-asset-writes.md) |
| 3b — domain writes (warranty, insurance, legal-case creates) | `feat/hono-phase-3b-domain-writes` (planned) | — | PLANNED → see [phase3b-domain-writes.md](./phase3b-domain-writes.md) |
| 3c — heavy writes (freeze, mint, AI analyze, trust-score, legal-doc, ledger submit/verify, seed-demo) | `feat/hono-phase-3c-heavy-writes` (planned) | — | PLANNED → see [phase3c-heavy-writes.md](./phase3c-heavy-writes.md) |
| 4 — R2 object routes (`/objects/:path`, upload, evidence-files ACL) | `feat/hono-phase-4-r2-routes` (planned) | — | PLANNED → see [phase4-r2-routes.md](./phase4-r2-routes.md) |

Expected merge order: #33 → #34 → 2a → 2b → 2c → 3a → 3b → 3c → 4 → Express server retirement.

## Cross-cutting docs

- [test-strategy.md](./test-strategy.md) — real-Neon integration test harness (no mocks)
- [registry-status.md](./registry-status.md) — ChittyRegistry registration state

## ChittyRegistry status

Query against `https://registry.chitty.cc/api/v1/search?q=chittyassets` on
2026-05-16 returned `count: 0`. Service is **NOT REGISTERED**. See
[registry-status.md](./registry-status.md) for recommended registration payload.
Registration is a sensitive-intent operation and requires explicit operator
authorization via `ch1tty -> ChittyConnect`; this doc does not execute it.

## Compliance triad status

`CHARTER.md`, `CHITTY.md`, `AGENTS.md`, `SECURITY.md`, and `register.json`
land via PR #33 (`feat/hono-migration-phase-1`, commit `806c8a5`). They are
**not present on `main`** at the time this roadmap was written, but will be once
PR #33 merges. This doc PR does not recreate them to avoid merge conflicts
with PR #33. After PR #33 merges, re-validate the triad against this roadmap's
canonical posture section (especially Tier 4 classification, the binding name
`CHITTYASSETS_DB`, and the full P/L/T/E/A entity-type list).

## Routes not covered by phase plans

All routes in `server/routes.ts` are accounted for across phases 1, 2a–c, 3a–c, 4
except:

- `GET /api/auth/user` (`server/routes.ts:27`) — implemented in Phase 1 Worker
  (`worker/src/index.ts`). No further migration work.

When the last phase merges, `server/index.ts`, `server/routes.ts`, and the
Express middleware chain can be deleted; the Worker becomes the sole runtime.
