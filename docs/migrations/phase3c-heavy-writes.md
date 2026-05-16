---
uri: chittycanon://docs/tech/spec/chittyassets-phase3c
namespace: chittycanon://docs/tech
type: spec
version: 1.0.0
status: DRAFT
title: ChittyAssets Phase 3c — Heavy Writes (chain, AI, ledger)
visibility: INTERNAL
tags: [migration, hono, phase-3c, writes, ai, chittychain]
@canon: chittycanon://core/services/chittyassets
---

# Phase 3c — Heavy Writes

## Scope

| Method | Path | Source | External dep |
|--------|------|--------|--------------|
| POST | `/api/assets/:id/freeze` | `server/routes.ts:125` | ChittyMint (`mint.chitty.cc`) |
| POST | `/api/assets/:id/mint` | `server/routes.ts:166` | ChittyMint |
| POST | `/api/evidence/:evidenceId/analyze` | `server/routes.ts:379` | OpenAI GPT-4o |
| POST | `/api/legal/generate-document` | `server/routes.ts:557` | OpenAI GPT-4o |
| POST | `/api/assets/:assetId/calculate-trust-score` | `server/routes.ts:596` | ChittyTrust + OpenAI |
| POST | `/api/evidence-ledger/submit` | `server/routes.ts:51` | ChittyLedger |
| POST | `/api/evidence-ledger/:chittyId/verify` | `server/routes.ts:92` | ChittyLedger |
| POST | `/api/seed-demo` | `server/routes.ts:39` | none (Neon writes) |

## Canonical entity model

- **Freeze** event (E) initiates 7-day immutability window — produces Authority
  (A, Earned) attestation when mint completes
- **Mint** event (E) anchors asset Thing (T) to ChittyChain — `transactionHash`
  is the Authority (A) artifact
- **AI analysis** produces evidence trust scoring — Authority (A, Earned)
- All entity-type listings in this code path must enumerate P/L/T/E/A in full

## File layout

```
worker/src/
  clients/
    chittymint.ts      # freeze, mint
    chittyledger.ts    # extend Phase 2c client with submit, verify
    openai.ts          # GPT-4o wrapper (analyze, legal-doc, trust-score)
  routes/
    chain.ts           # freeze, mint
    ai.ts              # analyze, legal-doc, trust-score
    evidence-ledger-write.ts
    seed-demo.ts
  jobs/
    queue-bindings.ts  # if AI calls move to Cloudflare Queues
```

## External service bindings

Wrangler config (Phase 1 already established `wrangler.jsonc` — modifications
land in PR #33 or a follow-up; do NOT touch here):

```jsonc
{
  "vars": {
    "CHITTY_MINT_URL":  "https://mint.chitty.cc",
    "CHITTY_LEDGER_URL":"https://ledger.chitty.cc",
    "OPENAI_MODEL":     "gpt-4o-2024-08-06"
  },
  "secrets": ["OPENAI_API_KEY", "CHITTY_MINT_TOKEN"]
}
```

`OPENAI_API_KEY` and `CHITTY_MINT_TOKEN` are delivered via `wrangler secret
put` in CI from 1Password (`op run` pattern from operator manifest); never
inlined.

## Long-running concerns

Cloudflare Worker request CPU limit is ~30s on paid plans. GPT-4o calls for
legal-doc generation can exceed this. Recommended approach:

1. **Short path (analyze, trust-score)**: synchronous fetch with 25s timeout,
   return 504 on timeout.
2. **Long path (legal-doc, batch analyze)**: enqueue to Cloudflare Queues, return
   202 with a job ID; client polls `GET /api/jobs/:id`. Queue worker writes
   result into `ai_analysis_results` table (schema already exists per top-level
   `CLAUDE.md`).

Phase 3c lands the sync path first; queue migration tracked as a follow-up.

## Validation gates

1. Type-check clean.
2. Real-staging integration tests against `mint-staging.chitty.cc` and
   `ledger-staging.chitty.cc`. OpenAI tests use a recorded-replay fixture
   (`vcr`-style) against the real API in CI nightly, mocked-recording in PR CI
   (this is the one place we permit cassette-style replay — real upstream calls
   are exercised nightly).
3. Side-effect verification: after `POST /freeze`, assert
   `assets.chittyChainStatus = 'frozen'` AND a `timeline_events` row with
   `eventType = 'other'` and the freeze title exists.
4. Idempotency: double-POST `/freeze` on the same asset returns 409 (Express
   currently does not — see follow-up TODO).

## Estimated PR size

~1100 LOC + cassette fixtures. Largest phase. Strongly recommended to split
into 3c.1 (chain: freeze/mint), 3c.2 (AI: analyze/legal-doc/trust-score),
3c.3 (ledger writes + seed-demo) if review velocity matters.
