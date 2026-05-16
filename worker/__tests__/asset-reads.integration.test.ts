// @canon: chittycanon://core/services/chittyassets
// Integration tests for Phase 2a asset read routes.
// Tests call real Neon (ephemeral branch) — NO MOCKS, NO FAKE DATA.
//
// Test seam: uses registerAssetRoutes() with a claims-injecting pass-through
// middleware instead of requireChittyAuth, so we don't need a real JWT
// infrastructure. The data path (Drizzle → Neon) is 100% real.
//
// Per chittycanon://gov/governance#core-types — owner is a Person (P) entity.
// Authority (A), Location (L), Thing (T), Event (E) types are not exercised
// in this asset-read test but the type system enumerates all five.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Hono } from "hono";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { registerAssetRoutes } from "../src/routes/assets";
import type { ChittyAuthClaims, Env } from "../src/env";
import * as schema from "../../shared/schema";

// ---------------------------------------------------------------------------
// Test configuration — connection string from env var.
// ---------------------------------------------------------------------------
const TEST_DB_URL = process.env.TEST_DB_URL;
if (!TEST_DB_URL) {
  throw new Error(
    "TEST_DB_URL must be set to an ephemeral Neon branch connection string.",
  );
}

// ChittyOS-shaped fixture identities. Person (P) entities, canonical format.
const OWNER_CHITTY_ID = "01-A-CHT-ASST-P-5A-1-X";
const INTRUDER_CHITTY_ID = "01-A-CHT-ASST-P-5B-1-X";
let ASSET_ID_1: string;
let ASSET_ID_2: string;
let EVIDENCE_ID: string;

function buildTestApp(claimsOverride: ChittyAuthClaims) {
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
    c.set("claims", claimsOverride);
    await next();
  });

  const apiApp = new Hono<{
    Bindings: Env;
    Variables: { claims: ChittyAuthClaims };
  }>();
  registerAssetRoutes(apiApp, async (_c, next) => {
    await next();
  });
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
    email: "owner.test@chitty.cc",
  };
}

let sql: ReturnType<typeof postgres>;
let db: ReturnType<typeof drizzle>;

beforeAll(async () => {
  sql = postgres(TEST_DB_URL!, { ssl: "require", max: 1 });
  db = drizzle(sql, { schema });

  await db
    .insert(schema.users)
    .values({
      id: OWNER_CHITTY_ID,
      chittyId: OWNER_CHITTY_ID,
      email: "owner.test@chitty.cc",
      firstName: "Test",
      lastName: "Owner",
    })
    .onConflictDoNothing();

  const [a1] = await db
    .insert(schema.assets)
    .values({
      userId: OWNER_CHITTY_ID,
      name: "Artisan Pocket Watch — 1921 Patek Philippe",
      assetType: "jewelry",
      status: "active",
      currentValue: "42500.00",
      trustScore: "4.2",
      verificationStatus: "verified",
      chittyChainStatus: "minted",
    })
    .returning();
  ASSET_ID_1 = a1.id;

  const [a2] = await db
    .insert(schema.assets)
    .values({
      userId: OWNER_CHITTY_ID,
      name: "MacBook Pro M3 Max — Serial CK3T4P8XQ1",
      assetType: "electronics",
      status: "active",
      currentValue: "3200.00",
      trustScore: "3.8",
      verificationStatus: "pending",
      chittyChainStatus: "draft",
    })
    .returning();
  ASSET_ID_2 = a2.id;

  const [ev] = await db
    .insert(schema.evidence)
    .values({
      assetId: ASSET_ID_1,
      userId: OWNER_CHITTY_ID,
      name: "Patek Philippe Certificate of Authenticity",
      evidenceType: "contract",
      verificationStatus: "verified",
    })
    .returning();
  EVIDENCE_ID = ev.id;

  await db.insert(schema.timelineEvents).values({
    assetId: ASSET_ID_1,
    userId: OWNER_CHITTY_ID,
    eventType: "acquisition",
    title: "Watch acquired at Christie's auction — Lot 284",
    description: "Acquired via Christie's Geneva auction. Provenance verified.",
    eventDate: new Date("2024-11-15T10:30:00Z"),
  });
});

afterAll(async () => {
  if (ASSET_ID_1) {
    await sql`DELETE FROM timeline_events WHERE asset_id = ${ASSET_ID_1}`;
    await sql`DELETE FROM evidence WHERE asset_id = ${ASSET_ID_1}`;
  }
  if (ASSET_ID_2) {
    await sql`DELETE FROM assets WHERE id = ${ASSET_ID_2}`;
  }
  if (ASSET_ID_1) {
    await sql`DELETE FROM assets WHERE id = ${ASSET_ID_1}`;
  }
  await sql`DELETE FROM users WHERE id = ${OWNER_CHITTY_ID}`;
  await sql.end();
});

describe("GET /api/assets", () => {
  it("200 — returns owner's assets", async () => {
    const app = buildTestApp(ownerClaims());
    const res = await app.request("/api/assets");
    expect(res.status).toBe(200);
    const body = (await res.json()) as any[];
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(2);
    expect(body.every((a: any) => a.userId === OWNER_CHITTY_ID)).toBe(true);
  });

  it("200 — filter by assetType=jewelry returns only jewelry", async () => {
    const app = buildTestApp(ownerClaims());
    const res = await app.request("/api/assets?type=jewelry");
    expect(res.status).toBe(200);
    const body = (await res.json()) as any[];
    expect(body.every((a: any) => a.assetType === "jewelry")).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(1);
  });

  it("200 — intruder sees empty list (ownership filter)", async () => {
    const intruder: ChittyAuthClaims = {
      ...ownerClaims(),
      sub: INTRUDER_CHITTY_ID,
      chitty_id: INTRUDER_CHITTY_ID,
    };
    const app = buildTestApp(intruder);
    const res = await app.request("/api/assets");
    expect(res.status).toBe(200);
    const body = (await res.json()) as any[];
    expect(body.length).toBe(0);
  });
});

describe("GET /api/assets/stats", () => {
  it("200 — returns correct aggregate shape", async () => {
    const app = buildTestApp(ownerClaims());
    const res = await app.request("/api/assets/stats");
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(typeof body.totalAssets).toBe("number");
    expect(body.totalAssets).toBeGreaterThanOrEqual(2);
    expect(typeof body.totalValue).toBe("number");
    expect(typeof body.verifiedAssets).toBe("number");
    expect(typeof body.averageTrustScore).toBe("number");
    expect(body.assetsByType).toHaveProperty("jewelry");
    expect(body.assetsByType).toHaveProperty("electronics");
  });
});

describe("GET /api/assets/:id", () => {
  it("200 — returns asset for owner", async () => {
    const app = buildTestApp(ownerClaims());
    const res = await app.request(`/api/assets/${ASSET_ID_1}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.id).toBe(ASSET_ID_1);
    expect(body.userId).toBe(OWNER_CHITTY_ID);
  });

  it("404 — intruder cannot see owner's asset", async () => {
    const intruder: ChittyAuthClaims = {
      ...ownerClaims(),
      sub: INTRUDER_CHITTY_ID,
      chitty_id: INTRUDER_CHITTY_ID,
    };
    const app = buildTestApp(intruder);
    const res = await app.request(`/api/assets/${ASSET_ID_1}`);
    expect(res.status).toBe(404);
  });

  it("400 — bad UUID format returns 400", async () => {
    const app = buildTestApp(ownerClaims());
    const res = await app.request("/api/assets/not-a-uuid");
    expect(res.status).toBe(400);
  });
});

describe("GET /api/assets/:assetId/evidence", () => {
  it("200 — returns evidence list for owner's asset", async () => {
    const app = buildTestApp(ownerClaims());
    const res = await app.request(`/api/assets/${ASSET_ID_1}/evidence`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any[];
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(1);
    expect(body[0].id).toBe(EVIDENCE_ID);
  });

  it("200 — empty array for intruder query (no existence leak)", async () => {
    const intruder: ChittyAuthClaims = {
      ...ownerClaims(),
      sub: INTRUDER_CHITTY_ID,
      chitty_id: INTRUDER_CHITTY_ID,
    };
    const app = buildTestApp(intruder);
    const res = await app.request(`/api/assets/${ASSET_ID_1}/evidence`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any[];
    expect(body.length).toBe(0);
  });

  it("400 — bad assetId returns 400", async () => {
    const app = buildTestApp(ownerClaims());
    const res = await app.request("/api/assets/not-a-uuid/evidence");
    expect(res.status).toBe(400);
  });
});

describe("GET /api/assets/:assetId/timeline", () => {
  it("200 — returns timeline events for owner's asset", async () => {
    const app = buildTestApp(ownerClaims());
    const res = await app.request(`/api/assets/${ASSET_ID_1}/timeline`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any[];
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(1);
    expect(body[0].assetId).toBe(ASSET_ID_1);
    expect(body[0].eventType).toBe("acquisition");
  });

  it("400 — bad assetId returns 400", async () => {
    const app = buildTestApp(ownerClaims());
    const res = await app.request("/api/assets/bad-id/timeline");
    expect(res.status).toBe(400);
  });
});
