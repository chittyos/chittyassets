---
uri: chittycanon://docs/tech/spec/chittyassets-phase3b
namespace: chittycanon://docs/tech
type: spec
version: 1.0.0
status: DRAFT
title: ChittyAssets Phase 3b — Domain Writes
visibility: INTERNAL
tags: [migration, hono, phase-3b, writes]
@canon: chittycanon://core/services/chittyassets
---

# Phase 3b — Domain Writes (warranties, insurance, legal-cases)

## Scope

| Method | Path | Source | Insert schema |
|--------|------|--------|---------------|
| POST | `/api/assets/:assetId/warranties` | `server/routes.ts:476` | `insertWarrantySchema` |
| POST | `/api/assets/:assetId/insurance`   | `server/routes.ts:508` | `insertInsurancePolicySchema` |
| POST | `/api/legal-cases`                 | `server/routes.ts:540` | `insertLegalCaseSchema` |

These are straight INSERTs after zod validation and ownership check; no
external service calls, no transactions beyond a single row write.

## Canonical entity model

- Warranty: **Authority (A) — Granted** (manufacturer authority over coverage)
- Insurance policy: **Authority (A) — Granted** (insurer authority over claim)
- Legal case: **Event (E)** anchored to **Location (L) — jurisdiction**

All P/L/T/E/A appear: P (filer), L (jurisdiction), T (asset under claim),
E (case filing event), A (granted coverage). Code referencing entity-type
classification must declare all five — never omit Authority.

## File layout

```
worker/src/routes/
  warranties-write.ts
  insurance-write.ts
  legal-cases-write.ts
worker/src/db/queries/
  (extend warranties.ts, insurance.ts, legal-cases.ts from Phase 2b)
```

Re-use the zod schemas already exported from `shared/schema.ts`
(`insertWarrantySchema`, `insertInsurancePolicySchema`,
`insertLegalCaseSchema`) — do NOT redefine them in the Worker. Phase 2a
established that pattern.

## Validation

```ts
// example: warranties-write.ts
const body = await c.req.json();
const parsed = insertWarrantySchema.parse({
  ...body,
  assetId: c.req.param('assetId'),
  userId: c.get('userId'),
});

// ownership: insertWarrantySchema does not check assetId↔userId — do it explicitly
const asset = await db.query.assets.findFirst({
  where: and(eq(assets.id, parsed.assetId), eq(assets.userId, parsed.userId)),
});
if (!asset) return c.json({ error: 'asset_not_found' }, 404);

const [row] = await db.insert(warranties).values(parsed).returning();
return c.json(row, 201);
```

## External deps

None.

## Validation gates

1. Type-check clean.
2. Real-Neon integration tests covering happy path + cross-tenant probe per
   route (3 routes × 2 tests = 6 tests minimum).
3. zod failure path: post malformed body → 400 with `error.errors` echoed
   (matches Express behavior at `server/routes.ts:489`).

## Estimated PR size

~350 LOC. Smallest write phase — good candidate to land back-to-back with 3a.
