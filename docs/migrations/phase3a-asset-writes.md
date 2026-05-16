---
uri: chittycanon://docs/tech/spec/chittyassets-phase3a
namespace: chittycanon://docs/tech
type: spec
version: 1.0.0
status: DRAFT
title: ChittyAssets Phase 3a — Asset Writes
visibility: INTERNAL
tags: [migration, hono, phase-3a, writes]
@canon: chittycanon://core/services/chittyassets
---

# Phase 3a — Asset Writes

## Scope

| Method | Path | Source | Side effects |
|--------|------|--------|--------------|
| POST | `/api/assets` | `server/routes.ts:259` | mint ChittyID (T), trust score, create timeline event (E) |
| PUT | `/api/assets/:id` | `server/routes.ts:306` | update + timeline event (E) on status change |
| DELETE | `/api/assets/:id` | `server/routes.ts:323` | soft delete (recommended) + timeline event (E) |
| POST | `/api/assets/:assetId/evidence` | `server/routes.ts:346` | create evidence (T), timeline event (E) |

## Canonical entity model

Per `chittycanon://gov/governance`, an asset is **Thing (T)**, the owner is
**Person (P)**, creation is **Event (E)**, and the resulting trust score is
**Authority (A) — Earned**. All five P/L/T/E/A appear in the surrounding domain
model when location metadata (L) is captured on the asset payload.

## File layout

```
worker/src/
  routes/
    assets-write.ts   # POST, PUT, DELETE /api/assets[/:id]
    evidence-write.ts # POST /api/assets/:assetId/evidence
  db/
    queries/assets.ts          # insertAsset, updateAsset, softDeleteAsset
    queries/evidence.ts        # insertEvidence
    queries/timeline-events.ts # insertTimelineEvent
  schemas/
    asset-input.ts    # zod CreateAssetSchema, UpdateAssetSchema
    evidence-input.ts # zod CreateEvidenceSchema
```

## Validation (zod)

```ts
// schemas/asset-input.ts
import { z } from 'zod';
import { ENTITY_TYPES, CHITTY_ID_PATTERN } from '../env'; // ['P','L','T','E','A']

export const CreateAssetSchema = z.object({
  name: z.string().min(1).max(200),
  assetType: z.enum(['vehicle','property','jewelry','electronics','art','document','other']),
  purchasePrice: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  purchaseDate: z.coerce.date().optional(),
  description: z.string().max(2000).optional(),
  location: z.object({                   // L — Location
    jurisdiction: z.string().optional(),
    address: z.string().optional(),
  }).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const UpdateAssetSchema = CreateAssetSchema.partial().strict();
```

## Side effects

`POST /api/assets` flow (mirrors `server/routes.ts:259`):

1. `services.id.generate('asset')` → ChittyID matching `CHITTY_ID_PATTERN`
2. `services.trust.calculate(chittyId, payload)` → trustScore (Authority, A)
3. `db.transaction(tx => { insertAsset(tx, …); insertTimelineEvent(tx, { eventType: 'created' }); })`
4. Return 201 with full asset row

`POST /api/assets/:assetId/evidence` flow (mirrors `server/routes.ts:346`):

1. Verify asset ownership (`db.assets.where(id, userId)`); 404 if not found
2. Insert evidence (T) + timeline event (E, `eventType: 'evidence_added'`) in a
   single transaction
3. Return 201

## Ownership checks

Every write enforces `WHERE asset.user_id = :authUserId` at the SQL layer in
addition to ChittyAuth-derived `Person` principal check. This is intentional
defense-in-depth — a JWT compromise alone should not be enough to pivot to
another tenant's data.

## Validation gates

1. Type-check clean.
2. Real-Neon integration test (ephemeral branch):
   - Create asset → assert ChittyID matches `CHITTY_ID_PATTERN`
   - Update asset → assert `updated_at` advanced + timeline event row exists
   - Delete asset → assert soft-delete flag set, list endpoint excludes it
   - Cross-tenant probe: create asset as user A, attempt update as user B → 404
3. `curl` post-deploy with a real ChittyAuth token (operator-scoped) against
   `assets.chitty.cc`.

## Estimated PR size

~700 LOC (routes + zod + queries + tx wrapper + tests). Largest write PR until
3c; ChittyID and ChittyTrust dependencies make this the first phase where the
Worker takes a hard dep on Tier 0 services.
