// @canon: chittycanon://core/services/chittyassets
// R2 object storage routes — Phase 4 of Express→Hono migration.
//
// Per chittycanon://gov/governance#core-types — objects are Thing (T)
// artifacts owned by Person (P) principals. The `r2_object_acl` table
// (Authority-bearing? no — operational metadata) governs read/write
// grants. Authority (A), Location (L), Event (E) are not exercised here
// but the type enum at worker/src/env.ts covers all five P/L/T/E/A.
//
// Routes ported:
//   GET    /objects/:key                  server/routes.ts:618
//   POST   /api/objects/upload            server/routes.ts:641
//   PUT    /api/objects/upload/:token     (new — receives the actual upload)
//   PUT    /api/evidence-files            server/routes.ts:647
//
// Storage model:
//   - All user-served objects live in env.EVIDENCE bucket. PROCESSED is
//     reserved for server-written derivatives and not exposed via these routes.
//   - URL convention: /objects/<key> resolves to EVIDENCE/<key>. No
//     bucket prefix in the URL — single namespace for Phase 4.
//
// ACL model (per drizzle/0003_r2_object_acl.sql):
//   - Access = at least one non-revoked, non-expired r2_object_acl row for
//     (bucket, object_key, principal_chitty_id=claims.chitty_id,
//      permission IN ('read','owner')).
//   - On upload-finalize (PUT /api/evidence-files), an 'owner' row is
//     inserted for the caller's chitty_id.
//   - No public/shared visibility in Phase 4 — row-presence is the only gate.
//
// Upload model:
//   - POST /api/objects/upload returns a short-lived signed token embedded in
//     the upload URL. The client PUTs the file body to that URL; the Worker
//     streams it into R2. No S3 presigning, no aws4fetch dependency.
//   - Token is an HMAC over (object_key, chitty_id, exp) using OPENAI_API_KEY
//     as the secret-of-convenience? NO — use a dedicated UPLOAD_TOKEN_SECRET.
//     For Phase 4 we use a stateless token: <objectKey>.<exp>.<sig> where sig
//     = HMAC-SHA256(objectKey || ':' || chitty_id || ':' || exp, secret).
//   - Until UPLOAD_TOKEN_SECRET is provisioned, fall back to an opaque
//     unsigned token bound by short TTL + ownership check on finalize. The
//     ACL row inserted at finalize is the real authorization gate.

import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { and, eq, isNull, or, sql, inArray } from "drizzle-orm";
import { gt } from "drizzle-orm";
import { z } from "zod";
import { r2ObjectAcl } from "@shared/schema";
import { requireChittyAuth } from "../auth";
import { getDb } from "../db";
import type { Env, ChittyAuthClaims } from "../env";

type Variables = { claims: ChittyAuthClaims };
type AppType = { Bindings: Env; Variables: Variables };

// Object keys must be safe path-like strings. Reject traversal and absolute
// paths. R2 itself accepts most strings, but we constrain to a known charset.
const OBJECT_KEY_RE = /^[A-Za-z0-9._\-\/]{1,512}$/;
function isValidObjectKey(key: string): boolean {
  if (!OBJECT_KEY_RE.test(key)) return false;
  if (key.includes("..")) return false;
  if (key.startsWith("/")) return false;
  if (key.endsWith("/")) return false;
  return true;
}

// Bucket used for all user-served objects in Phase 4.
const PRIMARY_BUCKET = "chittyassets-evidence";

// Token TTL for upload URLs.
const UPLOAD_TOKEN_TTL_SECONDS = 15 * 60;

// Max upload size (10MB matches client-side ObjectUploader default).
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

// Parse the request body URL ({"fileURL": "...assets.chitty.cc/api/objects/upload/<token>"})
// and extract the object key from the upload token.
function decodeUploadToken(token: string): { objectKey: string; exp: number } | null {
  // Token format: base64url(objectKey).<exp>  — no signature in Phase 4 fallback.
  // The ACL row insertion at finalize is the security boundary.
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  try {
    const objectKey = atob(parts[0]!.replace(/-/g, "+").replace(/_/g, "/"));
    const exp = Number(parts[1]);
    if (!Number.isFinite(exp)) return null;
    if (!isValidObjectKey(objectKey)) return null;
    return { objectKey, exp };
  } catch {
    return null;
  }
}

function encodeUploadToken(objectKey: string, exp: number): string {
  const b64 = btoa(objectKey).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${b64}.${exp}`;
}

// Generate a UUID-shaped object key under a user-scoped prefix.
function newObjectKey(chittyId: string): string {
  // Use crypto.randomUUID for the unique part. Prefix with user dir for
  // human-debuggable layout in the R2 dashboard.
  const id = crypto.randomUUID();
  // Sanitize chittyId for path use (it's already constrained but be safe).
  const safeOwner = chittyId.replace(/[^A-Za-z0-9-]/g, "_");
  return `uploads/${safeOwner}/${id}`;
}

// Parse a fileURL submitted at finalize time. We accept either:
//   1. A full assets.chitty.cc URL pointing at /api/objects/upload/<token>
//   2. A bare object key (preferred for newly-uploaded objects)
function resolveObjectKeyFromFileURL(fileURL: string): string | null {
  // Try URL parse first.
  try {
    const u = new URL(fileURL);
    const path = u.pathname;
    const m = path.match(/^\/api\/objects\/upload\/(.+)$/);
    if (m) {
      const decoded = decodeUploadToken(m[1]!);
      return decoded ? decoded.objectKey : null;
    }
    const m2 = path.match(/^\/objects\/(.+)$/);
    if (m2 && isValidObjectKey(m2[1]!)) return m2[1]!;
    return null;
  } catch {
    // Not a URL — treat as bare key.
    if (isValidObjectKey(fileURL)) return fileURL;
    return null;
  }
}

// ACL read check — does claims.chitty_id have read access (read or owner) to
// (PRIMARY_BUCKET, objectKey)?
async function hasReadAccess(
  db: ReturnType<typeof getDb>,
  chittyId: string,
  objectKey: string,
): Promise<boolean> {
  const now = new Date();
  const rows = await db
    .select({ id: r2ObjectAcl.id })
    .from(r2ObjectAcl)
    .where(
      and(
        eq(r2ObjectAcl.bucket, PRIMARY_BUCKET),
        eq(r2ObjectAcl.objectKey, objectKey),
        eq(r2ObjectAcl.principalChittyId, chittyId),
        inArray(r2ObjectAcl.permission, ["read", "owner"] as const),
        isNull(r2ObjectAcl.revokedAt),
        or(isNull(r2ObjectAcl.expiresAt), gt(r2ObjectAcl.expiresAt, now)),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export function registerObjectRoutes(
  app: Hono<AppType>,
  authMiddleware: MiddlewareHandler<AppType>,
  // Mount mode: 'api' for /api/objects/* + finalize, 'root' for /objects/:key
  mode: "api" | "root",
) {
  if (mode === "root") {
    // -----------------------------------------------------------------
    // GET /objects/:key — fetch an R2 object, gated by ACL.
    // 401 unauthenticated, 404 missing-or-forbidden (no existence leak).
    // -----------------------------------------------------------------
    app.get("/objects/:key{.+}", authMiddleware, async (c) => {
      const claims = c.get("claims");
      const objectKey = c.req.param("key");
      if (!isValidObjectKey(objectKey)) {
        return c.json({ error: "invalid_object_key" }, 400);
      }
      const db = getDb(c.env.CHITTYASSETS_DB.connectionString);
      const allowed = await hasReadAccess(db, claims.chitty_id, objectKey);
      if (!allowed) {
        // No existence leak — same response for missing ACL and missing object.
        return c.json({ error: "not_found" }, 404);
      }
      const obj = await c.env.EVIDENCE.get(objectKey);
      if (!obj) {
        return c.json({ error: "not_found" }, 404);
      }
      return new Response(obj.body, {
        status: 200,
        headers: {
          etag: obj.httpEtag,
          "content-type":
            obj.httpMetadata?.contentType ?? "application/octet-stream",
          "last-modified": obj.uploaded.toUTCString(),
          "cache-control": "private, max-age=0, must-revalidate",
        },
      });
    });
    return;
  }

  // mode === "api"

  // -----------------------------------------------------------------
  // POST /api/objects/upload — mint a short-lived upload URL.
  // Returns { method: "PUT", uploadURL, objectKey } shaped to match the
  // existing Uppy AwsS3 non-multipart contract (getUploadParameters).
  // -----------------------------------------------------------------
  app.post("/objects/upload", authMiddleware, async (c) => {
    const claims = c.get("claims");
    const objectKey = newObjectKey(claims.chitty_id);
    const exp = Math.floor(Date.now() / 1000) + UPLOAD_TOKEN_TTL_SECONDS;
    const token = encodeUploadToken(objectKey, exp);

    // Build URL from the incoming request origin so dev/prod both work.
    const origin = new URL(c.req.url).origin;
    const uploadURL = `${origin}/api/objects/upload/${token}`;

    return c.json({
      method: "PUT" as const,
      uploadURL,
      url: uploadURL, // Uppy AwsS3 reads `url`; keep both for compat.
      objectKey,
      expiresAt: new Date(exp * 1000).toISOString(),
    });
  });

  // -----------------------------------------------------------------
  // PUT /api/objects/upload/:token — receive the actual upload body and
  // stream into R2. The ACL row is NOT inserted here — that happens at
  // finalize (PUT /api/evidence-files) so that orphaned uploads have no
  // owner row to leak access through.
  // -----------------------------------------------------------------
  app.put("/objects/upload/:token", authMiddleware, async (c) => {
    const claims = c.get("claims");
    const token = c.req.param("token");
    const decoded = decodeUploadToken(token);
    if (!decoded) {
      return c.json({ error: "invalid_upload_token" }, 400);
    }
    const nowSec = Math.floor(Date.now() / 1000);
    if (decoded.exp < nowSec) {
      return c.json({ error: "upload_token_expired" }, 410);
    }

    // Enforce that the token's embedded objectKey belongs to this caller —
    // the key embeds the owner ChittyID prefix from newObjectKey().
    const safeOwner = claims.chitty_id.replace(/[^A-Za-z0-9-]/g, "_");
    if (!decoded.objectKey.startsWith(`uploads/${safeOwner}/`)) {
      return c.json({ error: "forbidden" }, 403);
    }

    // Size cap via Content-Length. R2 will also enforce its own limits but
    // we want to fail fast.
    const contentLength = Number(c.req.header("content-length") ?? "0");
    if (contentLength > MAX_UPLOAD_BYTES) {
      return c.json({ error: "payload_too_large", limit: MAX_UPLOAD_BYTES }, 413);
    }

    const body = c.req.raw.body;
    if (!body) {
      return c.json({ error: "empty_body" }, 400);
    }

    const contentType = c.req.header("content-type") ?? "application/octet-stream";
    await c.env.EVIDENCE.put(decoded.objectKey, body, {
      httpMetadata: { contentType },
      customMetadata: {
        uploaderChittyId: claims.chitty_id,
      },
    });

    return c.json({ ok: true, objectKey: decoded.objectKey }, 200);
  });

  // -----------------------------------------------------------------
  // PUT /api/evidence-files — finalize: register the just-uploaded object
  // in r2_object_acl with permission='owner' for the caller. Optionally
  // scoped to an evidence/asset row via the request body.
  // -----------------------------------------------------------------
  const finalizeSchema = z.object({
    fileURL: z.string().min(1),
    evidenceId: z.string().uuid().optional(),
    assetId: z.string().uuid().optional(),
  });

  app.put("/evidence-files", authMiddleware, async (c) => {
    const claims = c.get("claims");
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "invalid_json" }, 400);
    }
    const parsed = finalizeSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        {
          error: "invalid_input",
          errors: parsed.error.errors.map((e) => ({
            path: e.path.join("."),
            message: e.message,
          })),
        },
        400,
      );
    }
    const objectKey = resolveObjectKeyFromFileURL(parsed.data.fileURL);
    if (!objectKey) {
      return c.json({ error: "invalid_file_url" }, 400);
    }

    // Object must actually exist in R2 before we register ownership —
    // otherwise we'd leak ACL rows for non-existent objects.
    const head = await c.env.EVIDENCE.head(objectKey);
    if (!head) {
      return c.json({ error: "object_not_uploaded" }, 404);
    }

    // Enforce ownership-by-key-prefix — the upload route already gated this,
    // but defend in depth in case fileURL is a bare key from another caller.
    const safeOwner = claims.chitty_id.replace(/[^A-Za-z0-9-]/g, "_");
    if (!objectKey.startsWith(`uploads/${safeOwner}/`)) {
      return c.json({ error: "forbidden" }, 403);
    }

    const db = getDb(c.env.CHITTYASSETS_DB.connectionString);
    // Idempotent insert — unique constraint on
    // (bucket, object_key, principal_chitty_id, permission) means re-finalize
    // is a no-op. Use ON CONFLICT DO NOTHING.
    await db
      .insert(r2ObjectAcl)
      .values({
        bucket: PRIMARY_BUCKET,
        objectKey,
        principalChittyId: claims.chitty_id,
        permission: "owner",
        grantedByChittyId: claims.chitty_id,
        evidenceId: parsed.data.evidenceId,
        assetId: parsed.data.assetId,
      })
      .onConflictDoNothing({
        target: [
          r2ObjectAcl.bucket,
          r2ObjectAcl.objectKey,
          r2ObjectAcl.principalChittyId,
          r2ObjectAcl.permission,
        ],
      });

    return c.json(
      {
        objectPath: `/objects/${objectKey}`,
        objectKey,
      },
      200,
    );
  });
}

// Production sub-apps. Two exports because /objects/:key sits at the root,
// not under /api.
export const objectApiRoutes = (() => {
  const r = new Hono<AppType>();
  registerObjectRoutes(r, requireChittyAuth, "api");
  return r;
})();

export const objectRootRoutes = (() => {
  const r = new Hono<AppType>();
  registerObjectRoutes(r, requireChittyAuth, "root");
  return r;
})();
