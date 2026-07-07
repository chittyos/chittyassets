---
uri: chittycanon://docs/tech/spec/chittyassets-test-strategy
namespace: chittycanon://docs/tech
type: spec
version: 1.0.0
status: DRAFT
title: ChittyAssets Migration Test Strategy
visibility: INTERNAL
tags: [testing, neon, integration, no-mocks]
@canon: chittycanon://core/services/chittyassets
---

# Test Strategy — Migration Phases 2a → 4

## Binding rule: no mocks for DB or upstream services

Per the operator's no-mocks policy (global `CLAUDE.md` — "No Mocks, Fake Data,
or Placeholder Endpoints"): every test in the migration must exercise real
behavior against a real datastore or a real deployed service. Specifically:

- **DB tests**: hit a real Neon branch via Hyperdrive
- **Upstream service tests**: hit staging deployments
  (`*-staging.chitty.cc`) — never `vi.mock('../clients/chittyledger')`
- **OpenAI tests**: recorded-replay cassettes refreshed against the real API
  on a nightly schedule (the single permitted exception, gated by cost)

## Neon branching strategy

Three modes, picked per phase:

### A. Ephemeral branch per test suite (recommended for write phases)

- CI creates a fresh Neon branch from `main-prod-snapshot` at suite start via
  the Neon MCP `create_branch` tool
- Connection string injected as `CHITTYASSETS_DB_TEST_URL`
- Suite tears branch down on completion (`delete_branch`)
- **Pros**: full isolation, parallelism-safe, real schema, real constraints
- **Cons**: ~5s branch creation overhead per suite, branch-quota pressure

Use for: Phase 3a, 3b, 3c, 4 (write paths). Each PR's CI gets a clean slate.

### B. Shared preview branch (recommended for read phases)

- Single long-lived `preview-chittyassets-tests` branch seeded with a known
  fixture set
- All read tests query against this branch, never mutate
- **Pros**: zero per-suite overhead, faster CI
- **Cons**: requires discipline — any test that mutates breaks the next test

Use for: Phase 2a, 2b, 2c (pure reads).

### C. Local Postgres (dev loop only, never CI)

- `docker compose up -d postgres` for fast iteration
- Schema applied via `npm run db:push`
- **Never** the validation gate for a PR — CI must use A or B

## Fixture seeding

Single source of truth: `worker/test/fixtures/seed.ts` (lands with Phase 2a).
Seeds canonical entities covering all P/L/T/E/A types:

```ts
// canonical fixture seeds — realistic values, no Lorem ipsum
export const SEED_USER_ID = 'did:chitty:user:00-1-USR-0001-P-A1-2-X';   // P
export const SEED_LOCATION_ID = '00-1-LOC-0001-L-A1-2-X';                // L
export const SEED_ASSET_ID = '00-1-AST-0001-T-A1-2-X';                   // T
export const SEED_EVENT_ID = '00-1-EVT-0001-E-A1-2-X';                   // E
export const SEED_AUTHORITY_ID = '00-1-AUT-0001-A-A1-2-X';               // A (Authority — never omit)
```

ChittyID format `VV-G-LLL-SSSS-T-YM-C-X` per `chittycanon://gov/governance`.
Type segment `T` is one of `P` (Person), `L` (Location), `T` (Thing),
`E` (Event), `A` (Authority). All five must appear in any entity-type list.

## Test harness skeleton

```ts
// worker/test/setup.ts
import { beforeAll, afterAll } from 'vitest';
import { app } from '../src/index';
import { seedCanonical } from './fixtures/seed';

let testDbUrl: string;

beforeAll(async () => {
  testDbUrl = process.env.CHITTYASSETS_DB_TEST_URL!;
  if (!testDbUrl) throw new Error('CHITTYASSETS_DB_TEST_URL required — real Neon branch only, no mocks');
  await seedCanonical(testDbUrl);
});

// In tests:
const res = await app.request('/api/assets/abc/warranties', {
  headers: { authorization: `Bearer ${TEST_JWT}` },
}, { CHITTYASSETS_DB: testDbUrl, CHITTY_AUTH_JWKS_URL: 'https://auth-staging.chitty.cc/jwks' });
expect(res.status).toBe(200);
const body = await res.json();
expect(body).toEqual(expect.arrayContaining([expect.objectContaining({ assetId: 'abc' })]));
```

`TEST_JWT` is a real ChittyAuth-issued token for a synthetic test Person,
minted at CI startup against `auth-staging.chitty.cc`.

## Pre-merge validation checklist

Every migration PR must demonstrate in the PR body:

1. `npm run check` clean (link to CI run)
2. `wrangler deploy --dry-run --env production` succeeded (paste size in KiB)
3. Integration suite run against real Neon (link to CI run)
4. For Phase 2c+: at least one `curl` against the deployed staging Worker
   showing the new route returns expected shape
5. For Phase 3a+: ownership probe (cross-tenant) test passing

## What we deliberately do NOT test

- The Express implementation is not under test during migration. It continues
  to receive production traffic until the Cloudflare route flips post-Phase 4.
  Migration tests target only the Worker.
- Vendor-side failures (OpenAI throttling, ChittyLedger maintenance) — these
  are validated by the runtime circuit-breaker behavior, not unit tests.
