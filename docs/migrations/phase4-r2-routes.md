---
uri: chittycanon://docs/tech/spec/chittyassets-phase4
namespace: chittycanon://docs/tech
type: spec
version: 1.0.0
status: DRAFT
title: ChittyAssets Phase 4 — R2 Object Routes
visibility: INTERNAL
tags: [migration, hono, phase-4, r2, storage]
@canon: chittycanon://core/services/chittyassets
---

# Phase 4 — R2 Object Routes

## Scope

| Method | Path | Source | Backend (Express) | Backend (Worker) |
|--------|------|--------|-------------------|------------------|
| GET | `/objects/:objectPath(*)` | `server/routes.ts:618` | GCS via `ObjectStorageService` | R2 bucket via Worker binding |
| POST | `/api/objects/upload` | `server/routes.ts:641` | GCS signed URL | R2 presigned PUT |
| PUT | `/api/evidence-files` | `server/routes.ts:647` | GCS ACL | `r2_object_acl` table + R2 key write |

## Storage migration

Express implementation uses Google Cloud Storage (`server/objectStorage.ts`,
ACL stored in object metadata). Phase 4 cuts over to Cloudflare R2:

- **Bucket binding**: `EVIDENCE_BUCKET` (wrangler `[[r2_buckets]]`)
- **ACL store**: `r2_object_acl` table — landed by PR #34 (Drizzle migration
  `0003`, schema canonical remediation). Columns: `object_path`, `owner_user_id`,
  `visibility`, `acl_rules` (jsonb), `created_at`, `updated_at`.
- **Historical GCS objects**: keep GCS read-through for 90 days; new uploads
  go to R2. A separate one-shot job migrates GCS → R2 in batches (not part of
  this PR; tracked as `chore/migrate-gcs-to-r2`).

## File layout

```
worker/src/
  routes/
    objects.ts         # GET /objects/:path(*), POST /api/objects/upload, PUT /api/evidence-files
  storage/
    r2-acl.ts          # canAccessObject(objectPath, userId, permission)
    r2-upload.ts       # createPresignedPut, finalizeUpload (writes acl row)
```

## ACL model

```ts
// storage/r2-acl.ts
import { eq } from 'drizzle-orm';
import { r2ObjectAcl } from '../../../shared/schema'; // landed by PR #34

export type Permission = 'READ' | 'WRITE' | 'DELETE';

export async function canAccessObject(
  db: DrizzleDB,
  objectPath: string,
  userId: string | undefined,
  permission: Permission,
): Promise<boolean> {
  const acl = await db.query.r2ObjectAcl.findFirst({ where: eq(r2ObjectAcl.objectPath, objectPath) });
  if (!acl) return false;
  if (acl.ownerUserId === userId) return true;
  if (acl.visibility === 'public' && permission === 'READ') return true;
  // acl.aclRules is jsonb: { allowedUsers: string[], allowedRoles: string[] }
  const rules = acl.aclRules ?? {};
  return userId !== undefined && Array.isArray(rules.allowedUsers) && rules.allowedUsers.includes(userId);
}
```

## GET `/objects/:path(*)`

```ts
app.get('/objects/:path{.+}', requireChittyAuth(), async (c) => {
  const objectPath = c.req.param('path');
  const userId = c.get('userId');
  const allowed = await canAccessObject(c.var.db, objectPath, userId, 'READ');
  if (!allowed) return c.body(null, 401);
  const obj = await c.env.EVIDENCE_BUCKET.get(objectPath);
  if (!obj) return c.body(null, 404);
  return new Response(obj.body, {
    headers: { 'content-type': obj.httpMetadata?.contentType ?? 'application/octet-stream' },
  });
});
```

## POST `/api/objects/upload`

Returns a presigned PUT URL. Cloudflare R2 supports S3-compatible presigned
URLs; alternatively the Worker proxies the upload itself (simpler — no
external presigning needed):

- Generate object key `evidence/${userId}/${uuid()}`
- Insert pending `r2_object_acl` row with `owner_user_id = userId`,
  `visibility = 'private'`
- Return `{ uploadURL: "/api/objects/upload-stream/${objectKey}", objectPath: objectKey }`

The client streams PUT to that URL; the Worker pipes to `EVIDENCE_BUCKET.put(...)`.
This avoids R2's need for AWS Sig-V4 client-side signing.

## PUT `/api/evidence-files`

Finalize: update `r2_object_acl` row from `pending` → `active`, attach to an
evidence row via FK. Mirrors `server/routes.ts:647`.

## Bindings (Wrangler — modifications NOT in this PR)

```jsonc
"r2_buckets": [
  { "binding": "EVIDENCE_BUCKET", "bucket_name": "chittyassets-evidence-prod",
    "preview_bucket_name": "chittyassets-evidence-staging" }
]
```

These additions land in the Phase 4 implementation PR, not in this doc PR.

## Validation gates

1. Type-check clean.
2. Real-R2 integration (preview bucket):
   - Upload via Worker → assert R2 object exists, ACL row inserted with
     `visibility = 'private'`
   - GET as owner → 200 with bytes
   - GET as different authed user → 401
   - GET unauthenticated → 401
3. GCS read-through fallback: assert legacy `gs://...` paths still resolve
   during the 90-day cutover.

## Estimated PR size

~600 LOC + bucket bindings. Final phase before Express retirement. Post-merge,
delete `server/objectStorage.ts`, the Express boot in `server/index.ts`, and
flip the `assets.chitty.cc` Cloudflare route to the Worker exclusively.
