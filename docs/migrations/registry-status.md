---
uri: chittycanon://docs/ops/registry/chittyassets-registration-status
namespace: chittycanon://docs/ops
type: registry
version: 1.0.0
status: DRAFT
title: ChittyAssets Registry Status
visibility: INTERNAL
tags: [registry, chittyregistry, compliance]
@canon: chittycanon://core/services/chittyassets
---

# ChittyRegistry Status — chittyassets

## Current state (2026-05-16)

Query: `GET https://registry.chitty.cc/api/v1/search?q=chittyassets`

```json
{ "success": true, "query": { "query": "chittyassets" }, "results": [], "count": 0 }
```

**Verdict: NOT REGISTERED.**

## Recommended registration payload

`register.json` lands on `main` via PR #33 (`feat/hono-migration-phase-1`,
commit `806c8a5`). Once that PR merges, the registration source of truth lives
at the repo root. Until then, the expected payload shape is:

```jsonc
{
  "name": "chittyassets",
  "canonical_uri": "chittycanon://core/services/chittyassets",
  "tier": 4,
  "domain": "domain",
  "url": "https://assets.chitty.cc",
  "health_url": "https://assets.chitty.cc/health",
  "status": "MIGRATING",
  "repo": "https://github.com/CHITTYOS/chittyassets",
  "compliance_triad": ["CHARTER.md", "CHITTY.md", "AGENTS.md"],
  "entity_types_handled": ["P", "L", "T", "E", "A"],
  "dependencies": ["chittyauth", "chittyid", "chittytrust", "chittyledger", "chittymint"],
  "bindings": {
    "hyperdrive": "CHITTYASSETS_DB",
    "r2_bucket": "EVIDENCE_BUCKET (Phase 4)"
  }
}
```

Note all five P/L/T/E/A entity types — Authority must not be omitted.

## Registration command (DO NOT RUN WITHOUT OPERATOR AUTHORIZATION)

Registry mutations are sensitive-intent operations per
`/home/ubuntu/.ch1tty/canon/system-wide-sensitive-intent-contract-v1.md`.
Route via `ch1tty -> ChittyConnect`:

```bash
# Suggested — requires operator approval; do not execute from agent context
ch1tty registry register \
  --canonical-uri chittycanon://core/services/chittyassets \
  --tier 4 \
  --from ./register.json
```

If the broker path is unavailable, fail closed with
`POLICY_BLOCKED_CHITTYCONNECT_UNAVAILABLE` — do not paste payloads inline.

## Recommended sequencing

1. Merge PR #33 (lands `register.json`)
2. Merge PR #34 (schema canonical remediation)
3. Operator runs `ch1tty registry register` once Phase 2a is in production
4. Subsequent phases update the registry record's `status` field
   (`MIGRATING` → `ACTIVE` after Phase 4 cuts Express over)
