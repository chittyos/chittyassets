// @canon: chittycanon://core/services/chittyassets
// Integration tests for Phase 3a asset write routes + evidence attach.
// Tests call real Neon (ephemeral branch) — NO MOCKS, NO FAKE DATA.
//
// Per chittycanon://gov/governance#core-types — Person (P) owner, Thing (T)
// asset/evidence, Event (E) timeline_event. Authority (A) and Location (L)
// are not exercised by these writes but the type enum at worker/src/env.ts
// covers all five P/L/T/E/A.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Hono } from "hono";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { registerAssetRoutes } from "../src/routes/assets";
import { registerEvidenceRoutes } from "../src/routes/evidence";
import type { ChittyAuthClaims, Env } from "../src/env";
import * as schema from "../../shared/schema";

const TEST_DB_URL = process.env.TEST_DB_URL;
if (!TEST_DB_URL) {
  throw new Error(
    "TEST_DB_URL must be set to an ephemeral Neon branch connection string.",
  );
}

// Distinct suffixes from asset-reads test (5A/5B) so parallel runs don't collide.
const OWNER_CHITTY_ID = "01-A-CHT-ASST-P-5C-1-X";
const INTRUDER_CHITTY_ID = "01-A-CHT-ASST-P-5D-1-X";

function buildTestApp(claimsOverride: ChittyAuthClaims | null) {
  const stubEnv = {
    ENVIRONMENT: "development" as const,
    CHITTYAUTH_ISSUER: "https://auth.chitty.cc",
    CHITTYAUTH_JWKS_URL: "https://auth.chitty.cc/.well-known/jwks.json",
    CHITTYAUTH_AUDIENCE: "chittyassets-api",
    CHITTYASSETS_DB: { connectionString: TEST_DB_URL } as unknown as Hyperdrive,
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

  const apiApp = new Hono<{
    Bindings: Env;
    Variables: { claims: ChittyAuthClaims };
  }>();

  const authMw = claimsOverride
    ? async (_c: any, next: any) => {
        await next();
      }
    : async (c: any) => c.json({ error: "unauthorized" }, 401);

  registerAssetRoutes(apiApp, authMw);
  registerEvidenceRoutes(apiApp, authMw);
  app.route("/api", apiApp);
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
    email: "writes.owner@chitty.cc",
  };
}

function intruderClaims(): ChittyAuthClaims {
  return {
    ...ownerClaims(),
    sub: INTRUDER_CHITTY_ID,
    chitty_id: INTRUDER_CHITTY_ID,
    email: "writes.intruder@chitty.cc",
  };
}

let sql: ReturnType<typeof postgres>;
let db: ReturnType<typeof drizzle>;
// Track every asset id created during the run for cleanup.
const createdAssetIds = new Set<string>();

beforeAll(async () => {
  sql = postgres(TEST_DB_URL!, { ssl: "require", max: 1 });
  db = drizzle(sql, { schema });

  await db
    .insert(schema.users)
    .values({
      id: OWNER_CHITTY_ID,
      chittyId: OWNER_CHITTY_ID,
      email: "writes.owner@chitty.cc",
      firstName: "Writes",
      lastName: "Owner",
    })
    .onConflictDoNothing();
  await db
    .insert(schema.users)
    .values({
      id: INTRUDER_CHITTY_ID,
      chittyId: INTRUDER_CHITTY_ID,
      email: "writes.intruder@chitty.cc",
      firstName: "Writes",
      lastName: "Intruder",
    })
    .onConflictDoNothing();
});

afterAll(async () => {
  for (const id of createdAssetIds) {
    await sql`DELETE FROM timeline_events WHERE asset_id = ${id}`;
    await sql`DELETE FROM evidence WHERE asset_id = ${id}`;
    await sql`DELETE FROM assets WHERE id = ${id}`;
  }
  await sql`DELETE FROM users WHERE id = ${OWNER_CHITTY_ID}`;
  await sql`DELETE FROM users WHERE id = ${INTRUDER_CHITTY_ID}`;
  await sql.end();
});

describe("POST /api/assets", () => {
  it("201 — creates asset and timeline acquisition event in one transaction", async () => {
    const app = buildTestApp(ownerClaims());
    const res = await app.request("/api/assets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Rolex Submariner 126610LN — Ref 2024-Q3 acquisition",
        assetType: "jewelry",
        currentValue: "14250.00",
        purchasePrice: "14250.00",
        manufacturer: "Rolex",
        model: "Submariner Date 126610LN",
        condition: "new",
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.id).toBeTruthy();
    expect(body.userId).toBe(OWNER_CHITTY_ID);
    expect(body.name).toContain("Rolex Submariner");
    createdAssetIds.add(body.id);

    // Re-read from DB to confirm asset row exists.
    const rows = await sql`SELECT id, user_id, name FROM assets WHERE id = ${body.id}`;
    expect(rows.length).toBe(1);
    expect(rows[0].user_id).toBe(OWNER_CHITTY_ID);

    // Confirm timeline event was created in same transaction.
    const events = await sql`
      SELECT event_type, title FROM timeline_events
      WHERE asset_id = ${body.id} AND event_type = 'acquisition'
    `;
    expect(events.length).toBe(1);
    expect(events[0].title).toContain("added to portfolio");
  });

  it("400 — rejects body missing required fields", async () => {
    const app = buildTestApp(ownerClaims());
    const res = await app.request("/api/assets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ description: "no name no type" }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error).toBe("invalid_input");
    expect(Array.isArray(body.errors)).toBe(true);
  });

  it("400 — rejects invalid JSON body", async () => {
    const app = buildTestApp(ownerClaims());
    const res = await app.request("/api/assets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not json{{",
    });
    expect(res.status).toBe(400);
  });

  it("401 — no auth claims returns 401", async () => {
    const app = buildTestApp(null);
    const res = await app.request("/api/assets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Should fail",
        assetType: "jewelry",
      }),
    });
    expect(res.status).toBe(401);
  });

  it("201 — client-supplied server-owned fields are stripped (userId/trustScore cannot be overridden)", async () => {
    const app = buildTestApp(ownerClaims());
    const res = await app.request("/api/assets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Strip-test asset — boundary verification",
        assetType: "electronics",
        // Attempted overrides — Zod schema omits these so they're dropped.
        userId: INTRUDER_CHITTY_ID,
        trustScore: "9.9",
        chittyId: "01-X-XXX-XXXX-T-99-9-Z",
        verificationStatus: "verified",
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    createdAssetIds.add(body.id);
    expect(body.userId).toBe(OWNER_CHITTY_ID);
    // chittyId may be null (deferred minting) or schema-generated, but never
    // the client-supplied value.
    expect(body.chittyId).not.toBe("01-X-XXX-XXXX-T-99-9-Z");
    // verificationStatus defaults to 'pending', not client-supplied 'verified'.
    expect(body.verificationStatus).toBe("pending");
  });
});

describe("PUT /api/assets/:id", () => {
  it("200 — owner updates own asset", async () => {
    // Seed an asset to update.
    const [asset] = await db
      .insert(schema.assets)
      .values({
        userId: OWNER_CHITTY_ID,
        name: "Pre-update name",
        assetType: "electronics",
        currentValue: "1000.00",
      })
      .returning();
    createdAssetIds.add(asset.id);

    const app = buildTestApp(ownerClaims());
    const res = await app.request(`/api/assets/${asset.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Post-update name — appraisal complete",
        currentValue: "1500.00",
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.name).toBe("Post-update name — appraisal complete");
    expect(body.currentValue).toBe("1500.00");

    // Re-read.
    const rows = await sql`SELECT name FROM assets WHERE id = ${asset.id}`;
    expect(rows[0].name).toBe("Post-update name — appraisal complete");
  });

  it("404 — intruder cannot update owner's asset", async () => {
    const [asset] = await db
      .insert(schema.assets)
      .values({
        userId: OWNER_CHITTY_ID,
        name: "Intruder probe target",
        assetType: "electronics",
      })
      .returning();
    createdAssetIds.add(asset.id);

    const app = buildTestApp(intruderClaims());
    const res = await app.request(`/api/assets/${asset.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "PWNED" }),
    });
    expect(res.status).toBe(404);

    // Confirm row was NOT modified.
    const rows = await sql`SELECT name FROM assets WHERE id = ${asset.id}`;
    expect(rows[0].name).toBe("Intruder probe target");
  });

  it("400 — bad UUID", async () => {
    const app = buildTestApp(ownerClaims());
    const res = await app.request("/api/assets/not-a-uuid", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "x" }),
    });
    expect(res.status).toBe(400);
  });

  it("401 — no auth", async () => {
    const app = buildTestApp(null);
    const res = await app.request(
      "/api/assets/00000000-0000-0000-0000-000000000000",
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "x" }),
      },
    );
    expect(res.status).toBe(401);
  });
});

describe("DELETE /api/assets/:id", () => {
  it("204 — owner deletes own asset and dependent rows cascade", async () => {
    const [asset] = await db
      .insert(schema.assets)
      .values({
        userId: OWNER_CHITTY_ID,
        name: "Deletion target",
        assetType: "electronics",
      })
      .returning();
    createdAssetIds.add(asset.id);
    await db.insert(schema.timelineEvents).values({
      assetId: asset.id,
      userId: OWNER_CHITTY_ID,
      eventType: "acquisition",
      title: "Will be cascaded",
      eventDate: new Date(),
    });

    const app = buildTestApp(ownerClaims());
    const res = await app.request(`/api/assets/${asset.id}`, {
      method: "DELETE",
    });
    expect(res.status).toBe(204);

    const rows = await sql`SELECT id FROM assets WHERE id = ${asset.id}`;
    expect(rows.length).toBe(0);
    const ev = await sql`SELECT id FROM timeline_events WHERE asset_id = ${asset.id}`;
    expect(ev.length).toBe(0);
  });

  it("404 — intruder cannot delete owner's asset", async () => {
    const [asset] = await db
      .insert(schema.assets)
      .values({
        userId: OWNER_CHITTY_ID,
        name: "Intruder delete probe",
        assetType: "electronics",
      })
      .returning();
    createdAssetIds.add(asset.id);

    const app = buildTestApp(intruderClaims());
    const res = await app.request(`/api/assets/${asset.id}`, {
      method: "DELETE",
    });
    expect(res.status).toBe(404);
    const rows = await sql`SELECT id FROM assets WHERE id = ${asset.id}`;
    expect(rows.length).toBe(1);
  });

  it("400 — bad UUID", async () => {
    const app = buildTestApp(ownerClaims());
    const res = await app.request("/api/assets/bad", { method: "DELETE" });
    expect(res.status).toBe(400);
  });

  it("401 — no auth", async () => {
    const app = buildTestApp(null);
    const res = await app.request(
      "/api/assets/00000000-0000-0000-0000-000000000000",
      { method: "DELETE" },
    );
    expect(res.status).toBe(401);
  });
});

describe("POST /api/assets/:assetId/evidence", () => {
  it("201 — attaches evidence and creates evidence_added timeline event", async () => {
    const [asset] = await db
      .insert(schema.assets)
      .values({
        userId: OWNER_CHITTY_ID,
        name: "Evidence host asset",
        assetType: "jewelry",
      })
      .returning();
    createdAssetIds.add(asset.id);

    const app = buildTestApp(ownerClaims());
    const res = await app.request(`/api/assets/${asset.id}/evidence`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Receipt — Tiffany & Co. 2024-11-20",
        evidenceType: "receipt",
        mimeType: "image/jpeg",
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.id).toBeTruthy();
    expect(body.assetId).toBe(asset.id);
    expect(body.userId).toBe(OWNER_CHITTY_ID);
    expect(body.evidenceType).toBe("receipt");

    // Confirm timeline event exists and points to this evidence.
    const ev = await sql`
      SELECT event_type, related_evidence_id FROM timeline_events
      WHERE asset_id = ${asset.id} AND event_type = 'evidence_added'
    `;
    expect(ev.length).toBe(1);
    expect(ev[0].related_evidence_id).toBe(body.id);
  });

  it("404 — intruder cannot attach evidence to owner's asset", async () => {
    const [asset] = await db
      .insert(schema.assets)
      .values({
        userId: OWNER_CHITTY_ID,
        name: "Evidence intrusion probe",
        assetType: "electronics",
      })
      .returning();
    createdAssetIds.add(asset.id);

    const app = buildTestApp(intruderClaims());
    const res = await app.request(`/api/assets/${asset.id}/evidence`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Forged receipt",
        evidenceType: "receipt",
      }),
    });
    expect(res.status).toBe(404);

    // Confirm no evidence was created on the asset.
    const evRows = await sql`SELECT id FROM evidence WHERE asset_id = ${asset.id}`;
    expect(evRows.length).toBe(0);
  });

  it("400 — bad assetId UUID", async () => {
    const app = buildTestApp(ownerClaims());
    const res = await app.request("/api/assets/not-uuid/evidence", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "x", evidenceType: "receipt" }),
    });
    expect(res.status).toBe(400);
  });

  it("400 — missing required fields", async () => {
    const [asset] = await db
      .insert(schema.assets)
      .values({
        userId: OWNER_CHITTY_ID,
        name: "Validation host",
        assetType: "electronics",
      })
      .returning();
    createdAssetIds.add(asset.id);

    const app = buildTestApp(ownerClaims());
    const res = await app.request(`/api/assets/${asset.id}/evidence`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mimeType: "image/png" }),
    });
    expect(res.status).toBe(400);
  });

  it("401 — no auth", async () => {
    const app = buildTestApp(null);
    const res = await app.request(
      "/api/assets/00000000-0000-0000-0000-000000000000/evidence",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "x", evidenceType: "receipt" }),
      },
    );
    expect(res.status).toBe(401);
  });
});
