---
uri: chittycanon://docs/tech/spec/chittyassets-phase2b
namespace: chittycanon://docs/tech
type: spec
version: 1.0.0
status: DRAFT
title: ChittyAssets Phase 2b — Simple Reads
visibility: INTERNAL
tags: [migration, hono, phase-2b]
@canon: chittycanon://core/services/chittyassets
---

# Phase 2b — Simple Reads (Neon-only, no external services)

## Scope

Pure-read endpoints that hit Neon via Hyperdrive (`CHITTYASSETS_DB`) and return
JSON. No external service calls, no AI, no R2.

| Method | Path | Source (Express) | Storage call |
|--------|------|------------------|--------------|
| GET | `/api/assets/:assetId/warranties` | `server/routes.ts:453` | `storage.getAssetWarranties(assetId, userId)` |
| GET | `/api/warranties/expiring?days=N` | `server/routes.ts:464` | `storage.getExpiringWarranties(userId, daysAhead)` |
| GET | `/api/assets/:assetId/insurance` | `server/routes.ts:497` | `storage.getAssetInsurance(assetId, userId)` |
| GET | `/api/legal-cases` | `server/routes.ts:529` | `storage.getUserLegalCases(userId)` |
| GET | `/api/tools/resources` | `server/routes.ts:117` | `listToolResources()` (static) |

## File layout

```
worker/src/routes/
  warranties.ts    # GET /api/assets/:assetId/warranties, GET /api/warranties/expiring
  insurance.ts     # GET /api/assets/:assetId/insurance
  legal-cases.ts   # GET /api/legal-cases
  tools.ts         # GET /api/tools/resources
worker/src/db/
  queries/warranties.ts
  queries/insurance.ts
  queries/legal-cases.ts
```

Each route module exports a `Hono` sub-app mounted in `worker/src/index.ts`
under the existing auth-guarded group established in Phase 2a.

## Query shapes (Drizzle pseudocode)

```ts
// queries/warranties.ts
import { eq, and, lte, gte } from 'drizzle-orm';
import { warranties, assets } from '../../../shared/schema';

export async function getAssetWarranties(db: DrizzleDB, assetId: string, userId: string) {
  // join enforces ownership at the SQL layer (defense in depth alongside auth)
  return db
    .select()
    .from(warranties)
    .innerJoin(assets, eq(warranties.assetId, assets.id))
    .where(and(eq(warranties.assetId, assetId), eq(assets.userId, userId)))
    .orderBy(warranties.expirationDate);
}

export async function getExpiringWarranties(db: DrizzleDB, userId: string, daysAhead: number) {
  const cutoff = new Date(Date.now() + daysAhead * 86_400_000);
  return db
    .select()
    .from(warranties)
    .innerJoin(assets, eq(warranties.assetId, assets.id))
    .where(and(
      eq(assets.userId, userId),
      gte(warranties.expirationDate, new Date()),
      lte(warranties.expirationDate, cutoff),
    ))
    .orderBy(warranties.expirationDate);
}
```

`getAssetInsurance` and `getUserLegalCases` follow the same ownership-via-join
pattern. `tools/resources` returns a static manifest derived from
`server/toolResources.ts` — port the module to `worker/src/lib/tool-resources.ts`
verbatim (no DB).

## External deps

None. This is the cleanest phase to land — pure Neon reads via the Hyperdrive
binding established in Phase 1.

## Validation gates

1. `npm run check` clean (Worker tsconfig).
2. `wrangler deploy --dry-run --env production` ≤ 260 KiB.
3. Real-Neon integration test (see [test-strategy.md](./test-strategy.md)):
   - Seed one user (Person, P) `did:chitty:user:phase2b-test`
   - Seed one asset (Thing, T) with `chitty_id` matching the canonical pattern
     `VV-G-LLL-SSSS-T-YM-C-X`
   - Seed two warranties (one expiring in 15 days, one in 90 days)
   - Hit each route via `app.request(...)` and assert shape + ownership filter
4. `curl` against deployed Worker post-merge:
   - `curl https://assets.chitty.cc/api/legal-cases -H 'Authorization: Bearer …'`
   - Assert `200` + array shape

## Estimated PR size

~400 LOC added (4 route modules + 4 query modules + tests). 0 LOC removed
(Express stays running in parallel — the Worker takes traffic only after the
Cloudflare route is flipped, post-Phase 4).
