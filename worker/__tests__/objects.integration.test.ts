// @canon: chittycanon://core/services/chittyassets
// Integration tests for Phase 4 R2 object routes.
//
// Real Neon for the r2_object_acl table (NO MOCKS on DB).
// R2 binding is implemented by an in-memory R2Bucket-shaped fake (NOT a mock
// of our code — it's a boundary-fake equivalent to the Hyperdrive shim used
// by every prior phase's tests). This is the documented choice for Phase 4
// because Miniflare's R2 simulator does not integrate cleanly with the
// existing app.request() / postgres-js harness used across Phases 2a–3c.
//
// Per chittycanon://gov/governance#core-types — objects are Thing (T)
// artifacts uploaded by Person (P) principals. All five P/L/T/E/A types
// are enumerated in worker/src/env.ts.

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Hono } from "hono";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { registerObjectRoutes } from "../src/routes/objects";
import type { ChittyAuthClaims, Env } from "../src/env";
import * as schema from "../../shared/schema";

const TEST_DB_URL = process.env.TEST_DB_URL;
if (!TEST_DB_URL) {
  throw new Error(
    "TEST_DB_URL must be set to an ephemeral Neon branch connection string.",
  );
}

// Distinct suffixes from prior phases (5C/5D used by asset writes).
const OWNER_CHITTY_ID = "01-A-CHT-ASST-P-5K-1-X";
const INTRUDER_CHITTY_ID = "01-A-CHT-ASST-P-5L-1-X";
const PRIMARY_BUCKET = "chittyassets-evidence";

// -----------------------------------------------------------------------
// In-memory R2 fake. Implements the subset of R2Bucket we use:
// put, get, head, delete. Real R2 semantics for body streaming + metadata.
// -----------------------------------------------------------------------
type StoredObject = {
  body: Uint8Array;
  httpMetadata: { contentType?: string };
  customMetadata: Record<string, string>;
  uploaded: Date;
  etag: string;
};

class InMemoryR2 {
  private store = new Map<string, StoredObject>();

  async put(
    key: string,
    body: ReadableStream<Uint8Array> | ArrayBuffer | Uint8Array | string | null,
    opts?: {
      httpMetadata?: { contentType?: string };
      customMetadata?: Record<string, string>;
    },
  ): Promise<unknown> {
    let bytes: Uint8Array;
    if (body == null) {
      bytes = new Uint8Array(0);
    } else if (body instanceof Uint8Array) {
      bytes = body;
    } else if (body instanceof ArrayBuffer) {
      bytes = new Uint8Array(body);
    } else if (typeof body === "string") {
      bytes = new TextEncoder().encode(body);
    } else {
      // ReadableStream — consume fully.
      const reader = (body as ReadableStream<Uint8Array>).getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        total += value.length;
      }
      bytes = new Uint8Array(total);
      let off = 0;
      for (const c of chunks) {
        bytes.set(c, off);
        off += c.length;
      }
    }
    const etag = `"${bytes.byteLength}-${Date.now()}"`;
    const obj: StoredObject = {
      body: bytes,
      httpMetadata: opts?.httpMetadata ?? {},
      customMetadata: opts?.customMetadata ?? {},
      uploaded: new Date(),
      etag,
    };
    this.store.set(key, obj);
    return { key, etag, uploaded: obj.uploaded };
  }

  async get(key: string): Promise<any> {
    const o = this.store.get(key);
    if (!o) return null;
    const bytes = o.body;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    });
    return {
      key,
      body: stream,
      httpEtag: o.etag,
      httpMetadata: o.httpMetadata,
      customMetadata: o.customMetadata,
      uploaded: o.uploaded,
      size: bytes.byteLength,
    };
  }

  async head(key: string): Promise<any> {
    const o = this.store.get(key);
    if (!o) return null;
    return {
      key,
      httpEtag: o.etag,
      httpMetadata: o.httpMetadata,
      customMetadata: o.customMetadata,
      uploaded: o.uploaded,
      size: o.body.byteLength,
    };
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  // Test helper.
  _seed(key: string, bytes: Uint8Array, contentType = "application/octet-stream"): void {
    this.store.set(key, {
      body: bytes,
      httpMetadata: { contentType },
      customMetadata: {},
      uploaded: new Date(),
      etag: `"seed-${bytes.byteLength}"`,
    });
  }
  _has(key: string): boolean {
    return this.store.has(key);
  }
  _get(key: string): StoredObject | undefined {
    return this.store.get(key);
  }
}

function buildTestApp(
  claimsOverride: ChittyAuthClaims | null,
  r2: InMemoryR2,
) {
  const stubEnv = {
    ENVIRONMENT: "development" as const,
    CHITTYAUTH_ISSUER: "https://auth.chitty.cc",
    CHITTYAUTH_JWKS_URL: "https://auth.chitty.cc/.well-known/jwks.json",
    CHITTYAUTH_AUDIENCE: "chittyassets-api",
    CHITTYASSETS_DB: { connectionString: TEST_DB_URL } as unknown as Hyperdrive,
    EVIDENCE: r2 as unknown as R2Bucket,
    PROCESSED: r2 as unknown as R2Bucket,
  } as Env;

  const app = new Hono<{
    Bindings: Env;
    Variables: { claims: ChittyAuthClaims };
  }>();
  app.use("*", async (c, next) => {
    Object.defineProperty(c, "env", {
      get: () => stubEnv,
      configurable: true,
    });
    if (claimsOverride) c.set("claims", claimsOverride);
    await next();
  });

  const authMw = claimsOverride
    ? async (_c: any, next: any) => {
        await next();
      }
    : async (c: any) => c.json({ error: "unauthorized" }, 401);

  const apiApp = new Hono<{
    Bindings: Env;
    Variables: { claims: ChittyAuthClaims };
  }>();
  registerObjectRoutes(apiApp, authMw, "api");
  app.route("/api", apiApp);

  const rootApp = new Hono<{
    Bindings: Env;
    Variables: { claims: ChittyAuthClaims };
  }>();
  registerObjectRoutes(rootApp, authMw, "root");
  app.route("/", rootApp);

  app.onError((err, c) => {
    // eslint-disable-next-line no-console
    console.error("test_error", err.message, err.stack);
    return c.json({ error: "internal_error", detail: err.message }, 500);
  });
  return app;
}

function ownerClaims(): ChittyAuthClaims {
  const now = Math.floor(Date.now() / 1000);
  return {
    iss: "https://auth.chitty.cc",
    sub: OWNER_CHITTY_ID,
    chitty_id: OWNER_CHITTY_ID,
    entity_type: "P",
    trust_level: 3,
    exp: now + 3600,
    iat: now,
    email: "objects.owner@chitty.cc",
  };
}

function intruderClaims(): ChittyAuthClaims {
  return {
    ...ownerClaims(),
    sub: INTRUDER_CHITTY_ID,
    chitty_id: INTRUDER_CHITTY_ID,
    email: "objects.intruder@chitty.cc",
  };
}

let sql: ReturnType<typeof postgres>;
let db: ReturnType<typeof drizzle>;
// Track every ACL row created during the run for cleanup.
const createdObjectKeys = new Set<string>();

beforeAll(async () => {
  sql = postgres(TEST_DB_URL!, { ssl: "require", max: 1 });
  db = drizzle(sql, { schema });
  await db
    .insert(schema.users)
    .values({
      id: OWNER_CHITTY_ID,
      chittyId: OWNER_CHITTY_ID,
      email: "objects.owner@chitty.cc",
      firstName: "Objects",
      lastName: "Owner",
    })
    .onConflictDoNothing();
  await db
    .insert(schema.users)
    .values({
      id: INTRUDER_CHITTY_ID,
      chittyId: INTRUDER_CHITTY_ID,
      email: "objects.intruder@chitty.cc",
      firstName: "Objects",
      lastName: "Intruder",
    })
    .onConflictDoNothing();
});

afterAll(async () => {
  for (const k of createdObjectKeys) {
    await sql`DELETE FROM r2_object_acl WHERE object_key = ${k}`;
  }
  await sql`DELETE FROM r2_object_acl WHERE principal_chitty_id IN (${OWNER_CHITTY_ID}, ${INTRUDER_CHITTY_ID})`;
  await sql`DELETE FROM users WHERE id = ${OWNER_CHITTY_ID}`;
  await sql`DELETE FROM users WHERE id = ${INTRUDER_CHITTY_ID}`;
  await sql.end();
});

let r2: InMemoryR2;
beforeEach(() => {
  r2 = new InMemoryR2();
});

describe("POST /api/objects/upload", () => {
  it("401 — unauthenticated", async () => {
    const app = buildTestApp(null, r2);
    const res = await app.request("/api/objects/upload", { method: "POST" });
    expect(res.status).toBe(401);
  });

  it("200 — mints an upload URL bound to the caller's ChittyID", async () => {
    const app = buildTestApp(ownerClaims(), r2);
    const res = await app.request("/api/objects/upload", { method: "POST" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.method).toBe("PUT");
    expect(body.uploadURL).toMatch(/\/api\/objects\/upload\//);
    expect(body.objectKey).toMatch(/^uploads\//);
    // Key prefix must encode the caller's ChittyID — defense in depth.
    expect(body.objectKey).toContain(OWNER_CHITTY_ID);
  });
});

describe("PUT /api/objects/upload/:token (proxy upload)", () => {
  it("200 — streams body to R2 under the token's key", async () => {
    const app = buildTestApp(ownerClaims(), r2);
    const mintRes = await app.request("/api/objects/upload", { method: "POST" });
    const mint = (await mintRes.json()) as any;
    const uploadPath = new URL(mint.uploadURL).pathname;

    const payload = new TextEncoder().encode("hello-r2-evidence-body");
    const putRes = await app.request(uploadPath, {
      method: "PUT",
      headers: { "content-type": "application/pdf" },
      body: payload,
    });
    expect(putRes.status).toBe(200);
    const putBody = (await putRes.json()) as any;
    expect(putBody.ok).toBe(true);
    expect(putBody.objectKey).toBe(mint.objectKey);
    expect(r2._has(mint.objectKey)).toBe(true);
    const stored = r2._get(mint.objectKey)!;
    expect(new TextDecoder().decode(stored.body)).toBe("hello-r2-evidence-body");
    expect(stored.httpMetadata.contentType).toBe("application/pdf");
    expect(stored.customMetadata.uploaderChittyId).toBe(OWNER_CHITTY_ID);
  });

  it("400 — malformed token", async () => {
    const app = buildTestApp(ownerClaims(), r2);
    const res = await app.request("/api/objects/upload/not-a-real-token", {
      method: "PUT",
      headers: { "content-type": "text/plain" },
      body: "x",
    });
    expect(res.status).toBe(400);
  });

  it("403 — token belongs to a different caller", async () => {
    // Owner mints, intruder tries to PUT.
    const ownerApp = buildTestApp(ownerClaims(), r2);
    const mint = (await (await ownerApp.request("/api/objects/upload", { method: "POST" })).json()) as any;
    const uploadPath = new URL(mint.uploadURL).pathname;

    const intruderApp = buildTestApp(intruderClaims(), r2);
    const res = await intruderApp.request(uploadPath, {
      method: "PUT",
      headers: { "content-type": "text/plain" },
      body: "stolen",
    });
    expect(res.status).toBe(403);
    expect(r2._has(mint.objectKey)).toBe(false);
  });

  it("413 — content-length exceeds limit", async () => {
    const app = buildTestApp(ownerClaims(), r2);
    const mint = (await (await app.request("/api/objects/upload", { method: "POST" })).json()) as any;
    const uploadPath = new URL(mint.uploadURL).pathname;
    const res = await app.request(uploadPath, {
      method: "PUT",
      headers: {
        "content-type": "application/octet-stream",
        "content-length": String(20 * 1024 * 1024), // 20MB > 10MB cap
      },
      body: new Uint8Array(8), // body itself is small; we check the header
    });
    expect(res.status).toBe(413);
  });
});

describe("PUT /api/evidence-files (finalize / register ACL)", () => {
  it("401 — unauthenticated", async () => {
    const app = buildTestApp(null, r2);
    const res = await app.request("/api/evidence-files", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fileURL: "uploads/foo/bar" }),
    });
    expect(res.status).toBe(401);
  });

  it("400 — missing fileURL", async () => {
    const app = buildTestApp(ownerClaims(), r2);
    const res = await app.request("/api/evidence-files", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("404 — object not yet uploaded", async () => {
    const app = buildTestApp(ownerClaims(), r2);
    const safeOwner = OWNER_CHITTY_ID.replace(/[^A-Za-z0-9-]/g, "_");
    const fakeKey = `uploads/${safeOwner}/00000000-0000-0000-0000-000000000000`;
    const res = await app.request("/api/evidence-files", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fileURL: fakeKey }),
    });
    expect(res.status).toBe(404);
  });

  it("200 — registers owner ACL row in r2_object_acl (real Neon)", async () => {
    const app = buildTestApp(ownerClaims(), r2);
    // Full end-to-end: mint, upload, finalize.
    const mint = (await (await app.request("/api/objects/upload", { method: "POST" })).json()) as any;
    const uploadPath = new URL(mint.uploadURL).pathname;
    await app.request(uploadPath, {
      method: "PUT",
      headers: { "content-type": "image/png" },
      body: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
    });
    createdObjectKeys.add(mint.objectKey);

    const finRes = await app.request("/api/evidence-files", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fileURL: mint.objectKey }),
    });
    expect(finRes.status).toBe(200);
    const finBody = (await finRes.json()) as any;
    expect(finBody.objectKey).toBe(mint.objectKey);
    expect(finBody.objectPath).toBe(`/objects/${mint.objectKey}`);

    // Verify ACL row exists in real Neon.
    const rows = await sql`
      SELECT bucket, object_key, principal_chitty_id, permission, revoked_at
      FROM r2_object_acl
      WHERE object_key = ${mint.objectKey}
    `;
    expect(rows.length).toBe(1);
    expect(rows[0].bucket).toBe(PRIMARY_BUCKET);
    expect(rows[0].principal_chitty_id).toBe(OWNER_CHITTY_ID);
    expect(rows[0].permission).toBe("owner");
    expect(rows[0].revoked_at).toBeNull();
  });

  it("200 — idempotent: re-finalize is a no-op", async () => {
    const app = buildTestApp(ownerClaims(), r2);
    const mint = (await (await app.request("/api/objects/upload", { method: "POST" })).json()) as any;
    await app.request(new URL(mint.uploadURL).pathname, {
      method: "PUT",
      headers: { "content-type": "text/plain" },
      body: "x",
    });
    createdObjectKeys.add(mint.objectKey);
    const finBody = JSON.stringify({ fileURL: mint.objectKey });
    await app.request("/api/evidence-files", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: finBody,
    });
    const second = await app.request("/api/evidence-files", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: finBody,
    });
    expect(second.status).toBe(200);
    const rows = await sql`
      SELECT count(*)::int AS n FROM r2_object_acl WHERE object_key = ${mint.objectKey}
    `;
    expect(rows[0].n).toBe(1);
  });

  it("403 — fileURL is a bare key not owned by the caller", async () => {
    // Pre-seed an object under intruder's prefix; owner tries to claim it.
    const safeIntruder = INTRUDER_CHITTY_ID.replace(/[^A-Za-z0-9-]/g, "_");
    const intruderKey = `uploads/${safeIntruder}/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa`;
    r2._seed(intruderKey, new Uint8Array([1, 2, 3]));

    const app = buildTestApp(ownerClaims(), r2);
    const res = await app.request("/api/evidence-files", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fileURL: intruderKey }),
    });
    expect(res.status).toBe(403);
  });
});

describe("GET /objects/:key (ACL-gated fetch)", () => {
  it("401 — unauthenticated", async () => {
    const app = buildTestApp(null, r2);
    const res = await app.request("/objects/uploads/anything/file");
    expect(res.status).toBe(401);
  });

  it("404 — no ACL row even though object exists in R2 (no existence leak)", async () => {
    const intruderApp = buildTestApp(intruderClaims(), r2);
    // Seed an object owned by no one in the ACL table.
    const safeOwner = OWNER_CHITTY_ID.replace(/[^A-Za-z0-9-]/g, "_");
    const key = `uploads/${safeOwner}/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb`;
    r2._seed(key, new TextEncoder().encode("secret"), "text/plain");
    const res = await intruderApp.request(`/objects/${key}`);
    expect(res.status).toBe(404);
  });

  it("200 — owner with ACL row reads object body + headers from R2", async () => {
    const app = buildTestApp(ownerClaims(), r2);
    // End-to-end mint → upload → finalize → read.
    const mint = (await (await app.request("/api/objects/upload", { method: "POST" })).json()) as any;
    const payload = "real-evidence-body-" + Math.random();
    await app.request(new URL(mint.uploadURL).pathname, {
      method: "PUT",
      headers: { "content-type": "text/plain" },
      body: payload,
    });
    await app.request("/api/evidence-files", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fileURL: mint.objectKey }),
    });
    createdObjectKeys.add(mint.objectKey);

    const res = await app.request(`/objects/${mint.objectKey}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/plain");
    expect(res.headers.get("etag")).toBeTruthy();
    expect(res.headers.get("last-modified")).toBeTruthy();
    const text = await res.text();
    expect(text).toBe(payload);
  });

  it("404 — intruder cannot read owner's object (real Neon ACL check)", async () => {
    const ownerApp = buildTestApp(ownerClaims(), r2);
    const mint = (await (await ownerApp.request("/api/objects/upload", { method: "POST" })).json()) as any;
    await ownerApp.request(new URL(mint.uploadURL).pathname, {
      method: "PUT",
      headers: { "content-type": "text/plain" },
      body: "owner-only",
    });
    await ownerApp.request("/api/evidence-files", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fileURL: mint.objectKey }),
    });
    createdObjectKeys.add(mint.objectKey);

    const intruderApp = buildTestApp(intruderClaims(), r2);
    const res = await intruderApp.request(`/objects/${mint.objectKey}`);
    expect(res.status).toBe(404);
  });

  it("404 — ACL row revoked", async () => {
    const app = buildTestApp(ownerClaims(), r2);
    const mint = (await (await app.request("/api/objects/upload", { method: "POST" })).json()) as any;
    await app.request(new URL(mint.uploadURL).pathname, {
      method: "PUT",
      headers: { "content-type": "text/plain" },
      body: "x",
    });
    await app.request("/api/evidence-files", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fileURL: mint.objectKey }),
    });
    createdObjectKeys.add(mint.objectKey);

    // Revoke directly in Neon.
    await sql`UPDATE r2_object_acl SET revoked_at = now() WHERE object_key = ${mint.objectKey}`;
    const res = await app.request(`/objects/${mint.objectKey}`);
    expect(res.status).toBe(404);
  });

  it("400 — path-traversal style object key rejected", async () => {
    const app = buildTestApp(ownerClaims(), r2);
    const res = await app.request("/objects/uploads/foo/../etc/passwd");
    expect(res.status).toBe(400);
  });
});
