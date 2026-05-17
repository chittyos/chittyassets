// @canon: chittycanon://core/services/chittyassets
// Integration tests for Phase 3b domain write routes:
//   POST /api/assets/:assetId/warranties
//   POST /api/assets/:assetId/insurance
//   POST /api/legal-cases
//
// Tests call real Neon (ephemeral branch) — NO MOCKS, NO FAKE DATA.
//
// Per chittycanon://gov/governance#core-types — Person (P) owner, Thing (T)
// warranty + insurance policy artifacts, Event (E) legal case. Authority (A)
// and Location (L) are not exercised by these writes but the type enum at
// worker/src/env.ts covers all five P/L/T/E/A.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Hono } from "hono";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { registerWarrantyRoutes } from "../src/routes/warranties";
import { registerInsuranceRoutes } from "../src/routes/insurance";
import { registerLegalCaseRoutes } from "../src/routes/legal-cases";
import type { ChittyAuthClaims, Env } from "../src/env";
import * as schema from "../../shared/schema";

const TEST_DB_URL = process.env.TEST_DB_URL;
if (!TEST_DB_URL) {
  throw new Error(
    "TEST_DB_URL must be set to an ephemeral Neon branch connection string.",
  );
}

// Suffixes 5E/5F to avoid collision with existing 5A..5L fixtures.
const OWNER_CHITTY_ID = "01-A-CHT-ASST-P-5E-1-X";
const INTRUDER_CHITTY_ID = "01-A-CHT-ASST-P-5F-1-X";

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

  registerWarrantyRoutes(apiApp, authMw);
  registerInsuranceRoutes(apiApp, authMw);
  registerLegalCaseRoutes(apiApp, authMw);
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
    email: "domain.owner@chitty.cc",
  };
}

function intruderClaims(): ChittyAuthClaims {
  return {
    ...ownerClaims(),
    sub: INTRUDER_CHITTY_ID,
    chitty_id: INTRUDER_CHITTY_ID,
    email: "domain.intruder@chitty.cc",
  };
}

let sql: ReturnType<typeof postgres>;
let db: ReturnType<typeof drizzle>;
const createdAssetIds = new Set<string>();
const createdLegalCaseIds = new Set<string>();

beforeAll(async () => {
  sql = postgres(TEST_DB_URL!, { ssl: "require", max: 1 });
  db = drizzle(sql, { schema });

  await db
    .insert(schema.users)
    .values({
      id: OWNER_CHITTY_ID,
      chittyId: OWNER_CHITTY_ID,
      email: "domain.owner@chitty.cc",
      firstName: "Domain",
      lastName: "Owner",
    })
    .onConflictDoNothing();
  await db
    .insert(schema.users)
    .values({
      id: INTRUDER_CHITTY_ID,
      chittyId: INTRUDER_CHITTY_ID,
      email: "domain.intruder@chitty.cc",
      firstName: "Domain",
      lastName: "Intruder",
    })
    .onConflictDoNothing();
});

afterAll(async () => {
  for (const id of createdAssetIds) {
    await sql`DELETE FROM warranties WHERE asset_id = ${id}`;
    await sql`DELETE FROM insurance_policies WHERE asset_id = ${id}`;
    await sql`DELETE FROM timeline_events WHERE asset_id = ${id}`;
    await sql`DELETE FROM evidence WHERE asset_id = ${id}`;
    await sql`DELETE FROM assets WHERE id = ${id}`;
  }
  for (const id of createdLegalCaseIds) {
    await sql`DELETE FROM legal_cases WHERE id = ${id}`;
  }
  await sql`DELETE FROM users WHERE id = ${OWNER_CHITTY_ID}`;
  await sql`DELETE FROM users WHERE id = ${INTRUDER_CHITTY_ID}`;
  await sql.end();
});

async function seedOwnerAsset(name: string) {
  const [asset] = await db
    .insert(schema.assets)
    .values({
      userId: OWNER_CHITTY_ID,
      name,
      assetType: "electronics",
    })
    .returning();
  createdAssetIds.add(asset.id);
  return asset;
}

describe("POST /api/assets/:assetId/warranties", () => {
  it("201 — owner creates warranty on own asset", async () => {
    const asset = await seedOwnerAsset("Warranty host — MacBook Pro 16 M3 Max");
    const app = buildTestApp(ownerClaims());
    const start = new Date("2025-01-15T00:00:00Z");
    const end = new Date("2028-01-15T00:00:00Z");
    const res = await app.request(`/api/assets/${asset.id}/warranties`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        provider: "AppleCare+",
        type: "extended",
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        coverage: "Accidental damage, battery service, 24/7 priority support",
        cost: "399.00",
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.id).toBeTruthy();
    expect(body.assetId).toBe(asset.id);
    expect(body.userId).toBe(OWNER_CHITTY_ID);
    expect(body.provider).toBe("AppleCare+");
    expect(body.isActive).toBe(true);

    const rows = await sql`
      SELECT asset_id, user_id, provider FROM warranties WHERE id = ${body.id}
    `;
    expect(rows.length).toBe(1);
    expect(rows[0].asset_id).toBe(asset.id);
    expect(rows[0].user_id).toBe(OWNER_CHITTY_ID);
  });

  it("404 — intruder cannot attach warranty to owner's asset", async () => {
    const asset = await seedOwnerAsset("Warranty intrusion probe");
    const app = buildTestApp(intruderClaims());
    const res = await app.request(`/api/assets/${asset.id}/warranties`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        provider: "ForgedCare",
        type: "extended",
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 86400000).toISOString(),
      }),
    });
    expect(res.status).toBe(404);
    const rows = await sql`SELECT id FROM warranties WHERE asset_id = ${asset.id}`;
    expect(rows.length).toBe(0);
  });

  it("400 — bad asset UUID", async () => {
    const app = buildTestApp(ownerClaims());
    const res = await app.request("/api/assets/not-uuid/warranties", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        provider: "X",
        type: "extended",
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString(),
      }),
    });
    expect(res.status).toBe(400);
  });

  it("400 — missing required fields", async () => {
    const asset = await seedOwnerAsset("Warranty validation host");
    const app = buildTestApp(ownerClaims());
    const res = await app.request(`/api/assets/${asset.id}/warranties`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ coverage: "only coverage, no provider/type/dates" }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error).toBe("invalid_input");
  });

  it("400 — invalid JSON body", async () => {
    const asset = await seedOwnerAsset("Warranty json host");
    const app = buildTestApp(ownerClaims());
    const res = await app.request(`/api/assets/${asset.id}/warranties`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json",
    });
    expect(res.status).toBe(400);
  });

  it("401 — no auth", async () => {
    const app = buildTestApp(null);
    const res = await app.request(
      "/api/assets/00000000-0000-0000-0000-000000000000/warranties",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: "X",
          type: "extended",
          startDate: new Date().toISOString(),
          endDate: new Date().toISOString(),
        }),
      },
    );
    expect(res.status).toBe(401);
  });

  it("201 — server-owned fields (userId/assetId/chittyId) are stripped", async () => {
    const asset = await seedOwnerAsset("Warranty strip-test host");
    const app = buildTestApp(ownerClaims());
    const res = await app.request(`/api/assets/${asset.id}/warranties`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        provider: "Squaretrade",
        type: "extended",
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 365 * 86400000).toISOString(),
        // Override attempts — schema omit drops these.
        userId: INTRUDER_CHITTY_ID,
        assetId: "00000000-0000-0000-0000-000000000000",
        chittyId: "01-X-XXX-XXXX-T-99-9-Z",
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.userId).toBe(OWNER_CHITTY_ID);
    expect(body.assetId).toBe(asset.id);
    expect(body.chittyId).not.toBe("01-X-XXX-XXXX-T-99-9-Z");
  });
});

describe("POST /api/assets/:assetId/insurance", () => {
  it("201 — owner creates policy on own asset", async () => {
    const asset = await seedOwnerAsset("Insurance host — 2024 Range Rover Sport");
    const app = buildTestApp(ownerClaims());
    const res = await app.request(`/api/assets/${asset.id}/insurance`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        provider: "Chubb Personal Insurance",
        policyNumber: "CHUBB-AUTO-2025-447821",
        type: "auto",
        coverageAmount: "150000.00",
        premium: "4200.00",
        deductible: "1000.00",
        startDate: new Date("2025-01-01T00:00:00Z").toISOString(),
        endDate: new Date("2026-01-01T00:00:00Z").toISOString(),
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.id).toBeTruthy();
    expect(body.assetId).toBe(asset.id);
    expect(body.userId).toBe(OWNER_CHITTY_ID);
    expect(body.policyNumber).toBe("CHUBB-AUTO-2025-447821");

    const rows = await sql`
      SELECT user_id, policy_number FROM insurance_policies WHERE id = ${body.id}
    `;
    expect(rows.length).toBe(1);
    expect(rows[0].user_id).toBe(OWNER_CHITTY_ID);
  });

  it("404 — intruder cannot attach policy to owner's asset", async () => {
    const asset = await seedOwnerAsset("Insurance intrusion probe");
    const app = buildTestApp(intruderClaims());
    const res = await app.request(`/api/assets/${asset.id}/insurance`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        provider: "ForgedInsurance Co",
        policyNumber: "FAKE-1",
        type: "auto",
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 86400000).toISOString(),
      }),
    });
    expect(res.status).toBe(404);
    const rows = await sql`
      SELECT id FROM insurance_policies WHERE asset_id = ${asset.id}
    `;
    expect(rows.length).toBe(0);
  });

  it("400 — bad asset UUID", async () => {
    const app = buildTestApp(ownerClaims());
    const res = await app.request("/api/assets/bad-uuid/insurance", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        provider: "x",
        policyNumber: "x",
        type: "auto",
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString(),
      }),
    });
    expect(res.status).toBe(400);
  });

  it("400 — missing required fields", async () => {
    const asset = await seedOwnerAsset("Insurance validation host");
    const app = buildTestApp(ownerClaims());
    const res = await app.request(`/api/assets/${asset.id}/insurance`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ premium: "100.00" }),
    });
    expect(res.status).toBe(400);
  });

  it("401 — no auth", async () => {
    const app = buildTestApp(null);
    const res = await app.request(
      "/api/assets/00000000-0000-0000-0000-000000000000/insurance",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: "x",
          policyNumber: "x",
          type: "auto",
          startDate: new Date().toISOString(),
          endDate: new Date().toISOString(),
        }),
      },
    );
    expect(res.status).toBe(401);
  });
});

describe("POST /api/legal-cases", () => {
  it("201 — owner creates legal case scoped to their chitty_id", async () => {
    const app = buildTestApp(ownerClaims());
    const res = await app.request("/api/legal-cases", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        caseNumber: "2025-CV-77821",
        title: "Property valuation dispute — Q1 2025 appraisal",
        description: "Disputed appraisal of insured collectibles portfolio",
        status: "active",
        court: "New York County Supreme Court",
        filingDate: new Date("2025-02-14T00:00:00Z").toISOString(),
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.id).toBeTruthy();
    expect(body.userId).toBe(OWNER_CHITTY_ID);
    expect(body.title).toContain("Property valuation dispute");
    createdLegalCaseIds.add(body.id);

    const rows = await sql`
      SELECT user_id, case_number FROM legal_cases WHERE id = ${body.id}
    `;
    expect(rows.length).toBe(1);
    expect(rows[0].user_id).toBe(OWNER_CHITTY_ID);
    expect(rows[0].case_number).toBe("2025-CV-77821");
  });

  it("201 — client-supplied userId/chittyId are stripped", async () => {
    const app = buildTestApp(ownerClaims());
    const res = await app.request("/api/legal-cases", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Server-owned-field strip verification",
        // Override attempts.
        userId: INTRUDER_CHITTY_ID,
        chittyId: "01-X-XXX-XXXX-E-99-9-Z",
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    createdLegalCaseIds.add(body.id);
    expect(body.userId).toBe(OWNER_CHITTY_ID);
    expect(body.chittyId).not.toBe("01-X-XXX-XXXX-E-99-9-Z");
  });

  it("400 — missing required title", async () => {
    const app = buildTestApp(ownerClaims());
    const res = await app.request("/api/legal-cases", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ description: "no title field" }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error).toBe("invalid_input");
  });

  it("400 — invalid JSON body", async () => {
    const app = buildTestApp(ownerClaims());
    const res = await app.request("/api/legal-cases", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json",
    });
    expect(res.status).toBe(400);
  });

  it("401 — no auth", async () => {
    const app = buildTestApp(null);
    const res = await app.request("/api/legal-cases", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "x" }),
    });
    expect(res.status).toBe(401);
  });
});
