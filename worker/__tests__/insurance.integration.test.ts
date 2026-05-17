// @canon: chittycanon://core/services/chittyassets
// Integration tests for Phase 2b insurance read route.
// Real Neon — NO MOCKS, NO FAKE DATA.
//
// Per chittycanon://gov/governance#core-types — owner is Person (P), insurance
// policy is Thing (T). All five P/L/T/E/A enumerated in env.ts.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Hono } from "hono";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { registerInsuranceRoutes } from "../src/routes/insurance";
import type { ChittyAuthClaims, Env } from "../src/env";
import * as schema from "../../shared/schema";

const TEST_DB_URL = process.env.TEST_DB_URL;
if (!TEST_DB_URL) {
  throw new Error(
    "TEST_DB_URL must be set to a Neon branch connection string.",
  );
}

const OWNER_CHITTY_ID = "01-A-CHT-ASST-P-5I-1-X";
const INTRUDER_CHITTY_ID = "01-A-CHT-ASST-P-5I-2-X";
let ASSET_ID: string;
let POLICY_ID_1: string;
let POLICY_ID_2: string;

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
  registerInsuranceRoutes(apiApp, async (_c, next) => {
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
    email: "insurance.owner@chitty.cc",
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
      email: "insurance.owner@chitty.cc",
      firstName: "Insurance",
      lastName: "Owner",
    })
    .onConflictDoNothing();

  const [asset] = await db
    .insert(schema.assets)
    .values({
      userId: OWNER_CHITTY_ID,
      name: "2024 Tesla Model 3 LR AWD — VIN 5YJ3E1EAXLF600842",
      assetType: "vehicle",
      status: "active",
      currentValue: "47200.00",
    })
    .returning();
  ASSET_ID = asset.id;

  const now = new Date();
  const in180Days = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);
  const in365Days = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

  const [p1] = await db
    .insert(schema.insurancePolicies)
    .values({
      assetId: ASSET_ID,
      userId: OWNER_CHITTY_ID,
      provider: "State Farm Mutual Automobile Insurance",
      policyNumber: "SF-AUTO-228104-IL",
      type: "comprehensive",
      coverageAmount: "100000.00",
      premium: "1842.00",
      deductible: "1000.00",
      startDate: oneYearAgo,
      endDate: in180Days,
      isActive: true,
    })
    .returning();
  POLICY_ID_1 = p1.id;

  const [p2] = await db
    .insert(schema.insurancePolicies)
    .values({
      assetId: ASSET_ID,
      userId: OWNER_CHITTY_ID,
      provider: "Geico Indemnity Co.",
      policyNumber: "GEICO-UMB-7710399",
      type: "umbrella",
      coverageAmount: "1000000.00",
      premium: "420.00",
      deductible: "0.00",
      startDate: oneYearAgo,
      endDate: in365Days,
      isActive: true,
    })
    .returning();
  POLICY_ID_2 = p2.id;
});

afterAll(async () => {
  if (POLICY_ID_1)
    await sql`DELETE FROM insurance_policies WHERE id = ${POLICY_ID_1}`;
  if (POLICY_ID_2)
    await sql`DELETE FROM insurance_policies WHERE id = ${POLICY_ID_2}`;
  if (ASSET_ID) await sql`DELETE FROM assets WHERE id = ${ASSET_ID}`;
  await sql`DELETE FROM users WHERE id = ${OWNER_CHITTY_ID}`;
  await sql.end();
});

describe("GET /api/assets/:assetId/insurance", () => {
  it("200 — returns insurance policies for owner's asset, sorted by endDate desc", async () => {
    const app = buildTestApp(ownerClaims());
    const res = await app.request(`/api/assets/${ASSET_ID}/insurance`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any[];
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(2);
    expect(body.every((p: any) => p.userId === OWNER_CHITTY_ID)).toBe(true);
    expect(body.every((p: any) => p.assetId === ASSET_ID)).toBe(true);
    // p2 (in365Days) comes first — desc by endDate.
    expect(body[0].id).toBe(POLICY_ID_2);
    expect(body[1].id).toBe(POLICY_ID_1);
  });

  it("200 — empty list for intruder (no existence leak)", async () => {
    const intruder: ChittyAuthClaims = {
      ...ownerClaims(),
      sub: INTRUDER_CHITTY_ID,
      chitty_id: INTRUDER_CHITTY_ID,
    };
    const app = buildTestApp(intruder);
    const res = await app.request(`/api/assets/${ASSET_ID}/insurance`);
    expect(res.status).toBe(200);
    expect((await res.json()) as any[]).toHaveLength(0);
  });

  it("400 — bad assetId returns 400", async () => {
    const app = buildTestApp(ownerClaims());
    const res = await app.request("/api/assets/not-a-uuid/insurance");
    expect(res.status).toBe(400);
  });
});
