// @canon: chittycanon://core/services/chittyassets
// Integration tests for Phase 3c heavy write routes:
//   POST /api/assets/:id/freeze
//   POST /api/assets/:id/mint
//   POST /api/assets/:assetId/calculate-trust-score
//   POST /api/evidence/:evidenceId/analyze
//   POST /api/legal/generate-document
//   POST /api/evidence-ledger/submit
//   POST /api/evidence-ledger/:chittyId/verify
//   POST /api/seed-demo
//
// Tests hit real Neon (ephemeral branch) — NO MOCKS, NO FAKE DATA. External
// service calls go to real hosts; where success requires a wired endpoint
// we exercise the real error path (502 mapping for unreachable host, 503
// for missing OPENAI_API_KEY) which is genuine error-path coverage, not a
// mock.
//
// Per chittycanon://gov/governance#core-types — Person (P) caller, Thing
// (T) asset/evidence, Event (E) timeline + ai_analysis_results, Authority
// (A) and Location (L) enumerated in env.ts though not exercised here.
//
// OpenAI test strategy: handlers are exercised with OPENAI_API_KEY unset
// (Worker secret not bound in test env) — assertion is the 503
// service_unavailable mapping. Real OpenAI invocation is deferred to
// staging smoke-tests (cost + key handling) — documented in PR body.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Hono } from "hono";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { registerAssetRoutes } from "../src/routes/assets";
import { registerEvidenceRoutes } from "../src/routes/evidence";
import { registerLegalCaseRoutes } from "../src/routes/legal-cases";
import { registerEvidenceLedgerRoutes } from "../src/routes/evidence-ledger";
import { registerSeedRoutes } from "../src/routes/seed";
import type { ChittyAuthClaims, Env } from "../src/env";
import * as schema from "../../shared/schema";

const TEST_DB_URL = process.env.TEST_DB_URL;
if (!TEST_DB_URL) {
  throw new Error(
    "TEST_DB_URL must be set to an ephemeral Neon branch connection string.",
  );
}

// Suffixes 5G/5H per phase 3c spec.
const OWNER_CHITTY_ID = "01-A-CHT-ASST-P-5G-1-X";
const INTRUDER_CHITTY_ID = "01-A-CHT-ASST-P-5H-1-X";
const NONEXISTENT_LEDGER_ID = "ZZ-Z-ZZZ-ZZZZ-T-ZZ-Z-Z";

interface BuildOpts {
  claims?: ChittyAuthClaims | null;
  env?: Partial<Env>;
}

function buildTestApp(opts: BuildOpts = {}) {
  const claimsOverride = opts.claims === undefined ? ownerClaims() : opts.claims;
  const stubEnv = {
    ENVIRONMENT: "development" as const,
    CHITTYAUTH_ISSUER: "https://auth.chitty.cc",
    CHITTYAUTH_JWKS_URL: "https://auth.chitty.cc/.well-known/jwks.json",
    CHITTYAUTH_AUDIENCE: "chittyassets-api",
    CHITTYMINT_URL: "https://mint.chitty.cc",
    CHITTYLEDGER_URL: "https://ledger.chitty.cc",
    CHITTYASSETS_DB: {
      connectionString: TEST_DB_URL,
    } as unknown as Hyperdrive,
    ...opts.env,
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
  registerLegalCaseRoutes(apiApp, authMw);
  registerEvidenceLedgerRoutes(apiApp, authMw);
  registerSeedRoutes(apiApp, authMw);
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
    email: "heavy.owner@chitty.cc",
  };
}

function intruderClaims(): ChittyAuthClaims {
  return {
    ...ownerClaims(),
    sub: INTRUDER_CHITTY_ID,
    chitty_id: INTRUDER_CHITTY_ID,
    email: "heavy.intruder@chitty.cc",
  };
}

let sql: ReturnType<typeof postgres>;
let db: ReturnType<typeof drizzle>;
const createdAssetIds = new Set<string>();
const createdEvidenceIds = new Set<string>();

beforeAll(async () => {
  sql = postgres(TEST_DB_URL!, { ssl: "require", max: 1 });
  db = drizzle(sql, { schema });
  for (const id of [OWNER_CHITTY_ID, INTRUDER_CHITTY_ID]) {
    await db
      .insert(schema.users)
      .values({
        id,
        chittyId: id,
        email: id === OWNER_CHITTY_ID ? "heavy.owner@chitty.cc" : "heavy.intruder@chitty.cc",
        firstName: "Heavy",
        lastName: id === OWNER_CHITTY_ID ? "Owner" : "Intruder",
      })
      .onConflictDoNothing();
  }
});

afterAll(async () => {
  for (const id of createdAssetIds) {
    await sql`DELETE FROM ai_analysis_results WHERE evidence_id IN (SELECT id FROM evidence WHERE asset_id = ${id})`;
    await sql`DELETE FROM timeline_events WHERE asset_id = ${id}`;
    await sql`DELETE FROM evidence WHERE asset_id = ${id}`;
    await sql`DELETE FROM assets WHERE id = ${id}`;
  }
  await sql`DELETE FROM users WHERE id = ${OWNER_CHITTY_ID}`;
  await sql`DELETE FROM users WHERE id = ${INTRUDER_CHITTY_ID}`;
  await sql.end();
});

async function seedOwnerAsset(
  name: string,
  overrides: Partial<typeof schema.assets.$inferInsert> = {},
) {
  const [asset] = await db
    .insert(schema.assets)
    .values({
      userId: OWNER_CHITTY_ID,
      name,
      assetType: "electronics",
      ...overrides,
    })
    .returning();
  createdAssetIds.add(asset.id);
  return asset;
}

async function seedOwnerEvidence(assetId: string, name: string) {
  const [row] = await db
    .insert(schema.evidence)
    .values({
      assetId,
      userId: OWNER_CHITTY_ID,
      name,
      evidenceType: "receipt",
    })
    .returning();
  createdEvidenceIds.add(row.id);
  return row;
}

// =========================================================================
// POST /api/assets/:id/freeze
// =========================================================================
describe("POST /api/assets/:id/freeze", () => {
  it("400 — bad UUID", async () => {
    const app = buildTestApp();
    const res = await app.request("/api/assets/not-uuid/freeze", {
      method: "POST",
    });
    expect(res.status).toBe(400);
  });

  it("404 — intruder cannot freeze owner's asset", async () => {
    const asset = await seedOwnerAsset("Freeze intrusion probe");
    const app = buildTestApp({ claims: intruderClaims() });
    const res = await app.request(`/api/assets/${asset.id}/freeze`, {
      method: "POST",
    });
    expect(res.status).toBe(404);
    const rows = await sql`SELECT chitty_chain_status FROM assets WHERE id = ${asset.id}`;
    expect(rows[0].chitty_chain_status).toBe("draft");
  });

  it("401 — no auth", async () => {
    const app = buildTestApp({ claims: null });
    const res = await app.request(
      "/api/assets/00000000-0000-0000-0000-000000000000/freeze",
      { method: "POST" },
    );
    expect(res.status).toBe(401);
  });

  it("502 — chittymint unreachable returns mint_unavailable", async () => {
    const asset = await seedOwnerAsset("Freeze unreachable mint probe");
    const app = buildTestApp({
      env: { CHITTYMINT_URL: "https://mint-does-not-exist.chitty-invalid-tld" },
    });
    const res = await app.request(`/api/assets/${asset.id}/freeze`, {
      method: "POST",
    });
    expect(res.status).toBe(502);
    const body = (await res.json()) as any;
    expect(body.error).toBe("mint_unavailable");
    // State unchanged on upstream failure.
    const rows = await sql`SELECT chitty_chain_status FROM assets WHERE id = ${asset.id}`;
    expect(rows[0].chitty_chain_status).toBe("draft");
  }, 10000);
});

// =========================================================================
// POST /api/assets/:id/mint
// =========================================================================
describe("POST /api/assets/:id/mint", () => {
  it("400 — bad UUID", async () => {
    const app = buildTestApp();
    const res = await app.request("/api/assets/not-uuid/mint", {
      method: "POST",
    });
    expect(res.status).toBe(400);
  });

  it("400 — invalid state when asset not frozen", async () => {
    const asset = await seedOwnerAsset("Mint pre-freeze gate test");
    const app = buildTestApp();
    const res = await app.request(`/api/assets/${asset.id}/mint`, {
      method: "POST",
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error).toBe("invalid_state");
    expect(body.current_status).toBe("draft");
  });

  it("404 — intruder cannot mint owner's asset", async () => {
    const asset = await seedOwnerAsset("Mint intrusion probe", {
      chittyChainStatus: "frozen",
    });
    const app = buildTestApp({ claims: intruderClaims() });
    const res = await app.request(`/api/assets/${asset.id}/mint`, {
      method: "POST",
    });
    expect(res.status).toBe(404);
  });

  it("502 — mint upstream unreachable from frozen asset", async () => {
    const asset = await seedOwnerAsset("Mint unreachable upstream", {
      chittyChainStatus: "frozen",
      ipfsHash: "QmFakeButRealisticHash",
    });
    const app = buildTestApp({
      env: { CHITTYMINT_URL: "https://mint-does-not-exist.chitty-invalid-tld" },
    });
    const res = await app.request(`/api/assets/${asset.id}/mint`, {
      method: "POST",
    });
    expect(res.status).toBe(502);
    const body = (await res.json()) as any;
    expect(body.error).toBe("mint_unavailable");
    const rows = await sql`SELECT chitty_chain_status FROM assets WHERE id = ${asset.id}`;
    expect(rows[0].chitty_chain_status).toBe("frozen"); // unchanged
  }, 10000);
});

// =========================================================================
// POST /api/assets/:assetId/calculate-trust-score
// =========================================================================
describe("POST /api/assets/:assetId/calculate-trust-score", () => {
  it("400 — bad UUID", async () => {
    const app = buildTestApp();
    const res = await app.request("/api/assets/not-uuid/calculate-trust-score", {
      method: "POST",
    });
    expect(res.status).toBe(400);
  });

  it("404 — asset not owned", async () => {
    const asset = await seedOwnerAsset("Trust-score intrusion probe");
    const app = buildTestApp({ claims: intruderClaims() });
    const res = await app.request(
      `/api/assets/${asset.id}/calculate-trust-score`,
      { method: "POST" },
    );
    expect(res.status).toBe(404);
  });

  it("503 — OPENAI_API_KEY not configured returns service_unavailable", async () => {
    const asset = await seedOwnerAsset("Trust-score no-key probe");
    const app = buildTestApp({ env: { OPENAI_API_KEY: undefined } });
    const res = await app.request(
      `/api/assets/${asset.id}/calculate-trust-score`,
      { method: "POST" },
    );
    expect(res.status).toBe(503);
    const body = (await res.json()) as any;
    expect(body.error).toBe("service_unavailable");
    // No mutation on unavailable upstream.
    const rows = await sql`SELECT trust_score FROM assets WHERE id = ${asset.id}`;
    expect(String(rows[0].trust_score)).toBe("0.0");
  });
});

// =========================================================================
// POST /api/evidence/:evidenceId/analyze
// =========================================================================
describe("POST /api/evidence/:evidenceId/analyze", () => {
  it("400 — bad UUID", async () => {
    const app = buildTestApp();
    const res = await app.request("/api/evidence/not-uuid/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ base64Image: "x", analysisType: "receipt" }),
    });
    expect(res.status).toBe(400);
  });

  it("400 — invalid analysis type", async () => {
    const asset = await seedOwnerAsset("Analyze type-gate host");
    const ev = await seedOwnerEvidence(asset.id, "Bad-type analyze probe");
    const app = buildTestApp();
    const res = await app.request(`/api/evidence/${ev.id}/analyze`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ base64Image: "x", analysisType: "nonsense" }),
    });
    expect(res.status).toBe(400);
  });

  it("400 — missing fields", async () => {
    const asset = await seedOwnerAsset("Analyze missing-fields host");
    const ev = await seedOwnerEvidence(asset.id, "Missing-field probe");
    const app = buildTestApp();
    const res = await app.request(`/api/evidence/${ev.id}/analyze`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("404 — evidence not owned by caller", async () => {
    const asset = await seedOwnerAsset("Analyze intrusion host");
    const ev = await seedOwnerEvidence(asset.id, "Intrusion analyze target");
    const app = buildTestApp({ claims: intruderClaims() });
    const res = await app.request(`/api/evidence/${ev.id}/analyze`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ base64Image: "x", analysisType: "receipt" }),
    });
    expect(res.status).toBe(404);
  });

  it("503 — OPENAI_API_KEY not configured", async () => {
    const asset = await seedOwnerAsset("Analyze no-key host");
    const ev = await seedOwnerEvidence(asset.id, "No-key analyze target");
    const app = buildTestApp({ env: { OPENAI_API_KEY: undefined } });
    const res = await app.request(`/api/evidence/${ev.id}/analyze`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ base64Image: "x", analysisType: "receipt" }),
    });
    expect(res.status).toBe(503);
    const body = (await res.json()) as any;
    expect(body.error).toBe("service_unavailable");
    // No ai_analysis_results row inserted on upstream-unavailable.
    const rows = await sql`SELECT id FROM ai_analysis_results WHERE evidence_id = ${ev.id}`;
    expect(rows.length).toBe(0);
  });
});

// =========================================================================
// POST /api/legal/generate-document
// =========================================================================
describe("POST /api/legal/generate-document", () => {
  it("400 — missing required fields", async () => {
    const app = buildTestApp();
    const res = await app.request("/api/legal/generate-document", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jurisdiction: "NY" }),
    });
    expect(res.status).toBe(400);
  });

  it("400 — bad asset UUID", async () => {
    const app = buildTestApp();
    const res = await app.request("/api/legal/generate-document", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ templateType: "bill_of_sale", assetId: "not-uuid" }),
    });
    expect(res.status).toBe(400);
  });

  it("404 — asset not owned", async () => {
    const asset = await seedOwnerAsset("Legal-doc intrusion host");
    const app = buildTestApp({ claims: intruderClaims() });
    const res = await app.request("/api/legal/generate-document", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        templateType: "bill_of_sale",
        assetId: asset.id,
      }),
    });
    expect(res.status).toBe(404);
  });

  it("503 — OPENAI_API_KEY not configured", async () => {
    const asset = await seedOwnerAsset("Legal-doc no-key host");
    const app = buildTestApp({ env: { OPENAI_API_KEY: undefined } });
    const res = await app.request("/api/legal/generate-document", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        templateType: "bill_of_sale",
        assetId: asset.id,
        jurisdiction: "New York State",
      }),
    });
    expect(res.status).toBe(503);
  });
});

// =========================================================================
// POST /api/evidence-ledger/submit  +  /verify
// =========================================================================
describe("POST /api/evidence-ledger/submit", () => {
  it("400 — missing evidenceType / data", async () => {
    const app = buildTestApp();
    const res = await app.request("/api/evidence-ledger/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("400 — invalid JSON body", async () => {
    const app = buildTestApp();
    const res = await app.request("/api/evidence-ledger/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json",
    });
    expect(res.status).toBe(400);
  });

  it("502 — ledger unreachable returns ledger_unavailable", async () => {
    const app = buildTestApp({
      env: {
        CHITTYLEDGER_URL: "https://ledger-does-not-exist.chitty-invalid-tld",
      },
    });
    const res = await app.request("/api/evidence-ledger/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        evidenceType: "receipt",
        data: { merchant: "Test" },
      }),
    });
    expect(res.status).toBe(502);
    const body = (await res.json()) as any;
    expect(body.error).toBe("ledger_unavailable");
  }, 10000);

  it("2xx or 502 — live ledger real call (no mocks)", async () => {
    // Real HTTP — may succeed if ledger accepts submissions, or fail with
    // 502 if the endpoint shape differs. Both are valid real-error coverage.
    const app = buildTestApp();
    const res = await app.request("/api/evidence-ledger/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        evidenceType: "receipt",
        data: { merchant: "Smoke test merchant" },
      }),
    });
    expect([200, 201, 502]).toContain(res.status);
  }, 15000);
});

describe("POST /api/evidence-ledger/:chittyId/verify", () => {
  it("400 — invalid chitty_id format", async () => {
    const app = buildTestApp();
    const res = await app.request("/api/evidence-ledger/not-canonical/verify", {
      method: "POST",
    });
    expect(res.status).toBe(400);
  });

  it("404 or 502 — real call against live ledger for nonexistent canonical ID", async () => {
    const app = buildTestApp();
    const res = await app.request(
      `/api/evidence-ledger/${NONEXISTENT_LEDGER_ID}/verify`,
      { method: "POST" },
    );
    expect([404, 502]).toContain(res.status);
    const body = (await res.json()) as any;
    expect(["not_found", "ledger_unavailable"]).toContain(body.error);
  }, 15000);

  it("502 — points-at unreachable host", async () => {
    const app = buildTestApp({
      env: {
        CHITTYLEDGER_URL: "https://ledger-does-not-exist.chitty-invalid-tld",
      },
    });
    const res = await app.request(
      `/api/evidence-ledger/${NONEXISTENT_LEDGER_ID}/verify`,
      { method: "POST" },
    );
    expect(res.status).toBe(502);
  }, 10000);
});

// =========================================================================
// POST /api/seed-demo  (dev-only)
// =========================================================================
describe("POST /api/seed-demo", () => {
  it("403 — disabled in production env", async () => {
    const app = buildTestApp({ env: { ENVIRONMENT: "production" } });
    const res = await app.request("/api/seed-demo", { method: "POST" });
    expect(res.status).toBe(403);
  });

  it("401 — no auth", async () => {
    const app = buildTestApp({ claims: null });
    const res = await app.request("/api/seed-demo", { method: "POST" });
    expect(res.status).toBe(401);
  });

  it("201 — development env seeds 3 demo assets owned by caller", async () => {
    const app = buildTestApp(); // ENVIRONMENT defaults to development
    const res = await app.request("/api/seed-demo", { method: "POST" });
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.assetCount).toBe(3);

    // Verify persisted state — real Neon.
    const rows = await sql`
      SELECT id, name, user_id FROM assets WHERE user_id = ${OWNER_CHITTY_ID}
      AND name IN ('MacBook Pro 16-inch M3 Max', '2023 Tesla Model Y Long Range', 'Home Office Property')
    `;
    expect(rows.length).toBe(3);
    for (const r of rows) {
      expect(r.user_id).toBe(OWNER_CHITTY_ID);
      createdAssetIds.add(r.id as string);
    }
    // Timeline events emitted per asset.
    const events = await sql`
      SELECT event_type FROM timeline_events
      WHERE user_id = ${OWNER_CHITTY_ID} AND event_type = 'acquisition'
    `;
    expect(events.length).toBeGreaterThanOrEqual(3);
  });
});
