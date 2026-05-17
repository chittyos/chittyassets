// @canon: chittycanon://core/services/chittyassets
// Integration tests for Phase 2b warranty read routes.
// Real Neon — NO MOCKS, NO FAKE DATA.
//
// Test seam: registerWarrantyRoutes() with a pass-through middleware in place
// of requireChittyAuth, so we don't depend on real JWT infra. The data path
// (Drizzle → Neon) is 100% real.
//
// Per chittycanon://gov/governance#core-types — owner is Person (P), warranty
// is Thing (T). All five P/L/T/E/A enumerated in env.ts.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Hono } from "hono";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { registerWarrantyRoutes } from "../src/routes/warranties";
import type { ChittyAuthClaims, Env } from "../src/env";
import * as schema from "../../shared/schema";

const TEST_DB_URL = process.env.TEST_DB_URL;
if (!TEST_DB_URL) {
  throw new Error(
    "TEST_DB_URL must be set to a Neon branch connection string.",
  );
}

// Person (P) fixture identities — canonical ChittyID format.
const OWNER_CHITTY_ID = "01-A-CHT-ASST-P-5W-1-X";
const INTRUDER_CHITTY_ID = "01-A-CHT-ASST-P-5W-2-X";
let ASSET_ID: string;
let WARRANTY_ACTIVE_ID: string;
let WARRANTY_EXPIRING_ID: string;
let WARRANTY_EXPIRED_ID: string;
let WARRANTY_INACTIVE_ID: string;

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
  registerWarrantyRoutes(apiApp, async (_c, next) => {
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
    email: "warranty.owner@chitty.cc",
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
      email: "warranty.owner@chitty.cc",
      firstName: "Warranty",
      lastName: "Owner",
    })
    .onConflictDoNothing();

  const [asset] = await db
    .insert(schema.assets)
    .values({
      userId: OWNER_CHITTY_ID,
      name: "Sub-Zero PRO 48 Refrigerator — Serial SZ48PRO-9842",
      assetType: "other",
      status: "active",
      currentValue: "18750.00",
    })
    .returning();
  ASSET_ID = asset.id;

  const now = new Date();
  const in10Days = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
  const in60Days = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
  const twoYearsAgo = new Date(now.getTime() - 730 * 24 * 60 * 60 * 1000);

  // Active warranty expiring in 10 days — should appear in /expiring?days=30.
  const [wExp] = await db
    .insert(schema.warranties)
    .values({
      assetId: ASSET_ID,
      userId: OWNER_CHITTY_ID,
      provider: "Sub-Zero Manufacturer Warranty",
      type: "manufacturer",
      startDate: twoYearsAgo,
      endDate: in10Days,
      coverage: "Compressor and sealed system — 12 years parts",
      isActive: true,
    })
    .returning();
  WARRANTY_EXPIRING_ID = wExp.id;

  // Active warranty expiring in 60 days — NOT in /expiring?days=30.
  const [wActive] = await db
    .insert(schema.warranties)
    .values({
      assetId: ASSET_ID,
      userId: OWNER_CHITTY_ID,
      provider: "Best Buy Geek Squad Protection",
      type: "extended",
      startDate: twoYearsAgo,
      endDate: in60Days,
      coverage: "Extended parts and labor coverage",
      isActive: true,
    })
    .returning();
  WARRANTY_ACTIVE_ID = wActive.id;

  // Expired warranty (endDate in past) — NOT in /expiring.
  const [wExpired] = await db
    .insert(schema.warranties)
    .values({
      assetId: ASSET_ID,
      userId: OWNER_CHITTY_ID,
      provider: "Original 90-day limited warranty",
      type: "limited",
      startDate: twoYearsAgo,
      endDate: tenDaysAgo,
      isActive: true,
    })
    .returning();
  WARRANTY_EXPIRED_ID = wExpired.id;

  // Inactive warranty (cancelled) — even though endDate within window, excluded.
  const [wInactive] = await db
    .insert(schema.warranties)
    .values({
      assetId: ASSET_ID,
      userId: OWNER_CHITTY_ID,
      provider: "Cancelled extended warranty plan",
      type: "extended",
      startDate: twoYearsAgo,
      endDate: in10Days,
      isActive: false,
    })
    .returning();
  WARRANTY_INACTIVE_ID = wInactive.id;
});

afterAll(async () => {
  if (WARRANTY_ACTIVE_ID)
    await sql`DELETE FROM warranties WHERE id = ${WARRANTY_ACTIVE_ID}`;
  if (WARRANTY_EXPIRING_ID)
    await sql`DELETE FROM warranties WHERE id = ${WARRANTY_EXPIRING_ID}`;
  if (WARRANTY_EXPIRED_ID)
    await sql`DELETE FROM warranties WHERE id = ${WARRANTY_EXPIRED_ID}`;
  if (WARRANTY_INACTIVE_ID)
    await sql`DELETE FROM warranties WHERE id = ${WARRANTY_INACTIVE_ID}`;
  if (ASSET_ID) await sql`DELETE FROM assets WHERE id = ${ASSET_ID}`;
  await sql`DELETE FROM users WHERE id = ${OWNER_CHITTY_ID}`;
  await sql.end();
});

describe("GET /api/assets/:assetId/warranties", () => {
  it("200 — returns all warranties for owner's asset", async () => {
    const app = buildTestApp(ownerClaims());
    const res = await app.request(`/api/assets/${ASSET_ID}/warranties`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any[];
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(4);
    expect(body.every((w: any) => w.userId === OWNER_CHITTY_ID)).toBe(true);
    expect(body.every((w: any) => w.assetId === ASSET_ID)).toBe(true);
  });

  it("200 — empty list for intruder (no existence leak)", async () => {
    const intruder: ChittyAuthClaims = {
      ...ownerClaims(),
      sub: INTRUDER_CHITTY_ID,
      chitty_id: INTRUDER_CHITTY_ID,
    };
    const app = buildTestApp(intruder);
    const res = await app.request(`/api/assets/${ASSET_ID}/warranties`);
    expect(res.status).toBe(200);
    expect((await res.json()) as any[]).toHaveLength(0);
  });

  it("400 — bad assetId returns 400", async () => {
    const app = buildTestApp(ownerClaims());
    const res = await app.request("/api/assets/not-a-uuid/warranties");
    expect(res.status).toBe(400);
  });
});

describe("GET /api/warranties/expiring", () => {
  it("200 — default 30 days returns only active warranties expiring in window", async () => {
    const app = buildTestApp(ownerClaims());
    const res = await app.request("/api/warranties/expiring");
    expect(res.status).toBe(200);
    const body = (await res.json()) as any[];
    expect(Array.isArray(body)).toBe(true);
    // Only WARRANTY_EXPIRING_ID matches (active + endDate within 30d + endDate >= now).
    const ids = body.map((w: any) => w.id);
    expect(ids).toContain(WARRANTY_EXPIRING_ID);
    expect(ids).not.toContain(WARRANTY_ACTIVE_ID); // 60d out
    expect(ids).not.toContain(WARRANTY_EXPIRED_ID); // already expired
    expect(ids).not.toContain(WARRANTY_INACTIVE_ID); // inactive
  });

  it("200 — days=90 widens window to include 60-day warranty", async () => {
    const app = buildTestApp(ownerClaims());
    const res = await app.request("/api/warranties/expiring?days=90");
    expect(res.status).toBe(200);
    const body = (await res.json()) as any[];
    const ids = body.map((w: any) => w.id);
    expect(ids).toContain(WARRANTY_EXPIRING_ID);
    expect(ids).toContain(WARRANTY_ACTIVE_ID);
    expect(ids).not.toContain(WARRANTY_EXPIRED_ID);
    expect(ids).not.toContain(WARRANTY_INACTIVE_ID);
  });

  it("200 — intruder sees empty list", async () => {
    const intruder: ChittyAuthClaims = {
      ...ownerClaims(),
      sub: INTRUDER_CHITTY_ID,
      chitty_id: INTRUDER_CHITTY_ID,
    };
    const app = buildTestApp(intruder);
    const res = await app.request("/api/warranties/expiring?days=90");
    expect(res.status).toBe(200);
    expect((await res.json()) as any[]).toHaveLength(0);
  });
});
