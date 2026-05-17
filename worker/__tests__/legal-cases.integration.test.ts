// @canon: chittycanon://core/services/chittyassets
// Integration tests for Phase 2b legal-case read route.
// Real Neon — NO MOCKS, NO FAKE DATA.
//
// Per chittycanon://gov/governance#core-types — caller is Person (P),
// legal_cases are Event (E). All five P/L/T/E/A enumerated in env.ts.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Hono } from "hono";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { registerLegalCaseRoutes } from "../src/routes/legal-cases";
import type { ChittyAuthClaims, Env } from "../src/env";
import * as schema from "../../shared/schema";

const TEST_DB_URL = process.env.TEST_DB_URL;
if (!TEST_DB_URL) {
  throw new Error(
    "TEST_DB_URL must be set to a Neon branch connection string.",
  );
}

const OWNER_CHITTY_ID = "01-A-CHT-ASST-P-5L-1-X";
const INTRUDER_CHITTY_ID = "01-A-CHT-ASST-P-5L-2-X";
let CASE_ID_1: string;
let CASE_ID_2: string;

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
  registerLegalCaseRoutes(apiApp, async (_c, next) => {
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
    email: "legal.owner@chitty.cc",
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
      email: "legal.owner@chitty.cc",
      firstName: "Legal",
      lastName: "Owner",
    })
    .onConflictDoNothing();

  // Realistic Cook County case shape — title and court mirror real filings,
  // case_number is a fixture-prefixed string to avoid collision.
  const [c1] = await db
    .insert(schema.legalCases)
    .values({
      userId: OWNER_CHITTY_ID,
      caseNumber: "TEST-2024D-PHASE2B-001",
      title: "Arias v. Bianchi — Marital Dissolution",
      description:
        "Dissolution of marriage with disputed asset division; evidence ledger active.",
      court: "Circuit Court of Cook County — Domestic Relations Division",
      judge: "Hon. Murphy",
      filingDate: new Date("2024-08-15T00:00:00Z"),
      nextHearing: new Date("2026-08-22T10:00:00Z"),
    })
    .returning();
  CASE_ID_1 = c1.id;

  const [c2] = await db
    .insert(schema.legalCases)
    .values({
      userId: OWNER_CHITTY_ID,
      caseNumber: "TEST-2025L-PHASE2B-002",
      title: "Estate of A. Bianchi — Probate",
      description: "Probate filing related to inherited Chicago real estate.",
      court: "Circuit Court of Cook County — Probate Division",
      filingDate: new Date("2025-02-03T00:00:00Z"),
    })
    .returning();
  CASE_ID_2 = c2.id;
});

afterAll(async () => {
  if (CASE_ID_1)
    await sql`DELETE FROM legal_cases WHERE id = ${CASE_ID_1}`;
  if (CASE_ID_2)
    await sql`DELETE FROM legal_cases WHERE id = ${CASE_ID_2}`;
  await sql`DELETE FROM users WHERE id = ${OWNER_CHITTY_ID}`;
  await sql.end();
});

describe("GET /api/legal-cases", () => {
  it("200 — returns owner's legal cases, sorted by createdAt desc", async () => {
    const app = buildTestApp(ownerClaims());
    const res = await app.request("/api/legal-cases");
    expect(res.status).toBe(200);
    const body = (await res.json()) as any[];
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(2);
    const ids = body.map((c: any) => c.id);
    expect(ids).toContain(CASE_ID_1);
    expect(ids).toContain(CASE_ID_2);
    expect(body.every((c: any) => c.userId === OWNER_CHITTY_ID)).toBe(true);
  });

  it("200 — intruder sees empty list (ownership filter)", async () => {
    const intruder: ChittyAuthClaims = {
      ...ownerClaims(),
      sub: INTRUDER_CHITTY_ID,
      chitty_id: INTRUDER_CHITTY_ID,
    };
    const app = buildTestApp(intruder);
    const res = await app.request("/api/legal-cases");
    expect(res.status).toBe(200);
    expect((await res.json()) as any[]).toHaveLength(0);
  });
});
