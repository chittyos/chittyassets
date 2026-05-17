// @canon: chittycanon://core/services/chittyassets
// Integration tests for Phase 2c evidence-ledger external read.
// REAL HTTP — no mocks. Tests verify: invalid ID guard (no upstream call),
// upstream-error mapping (real call to a sentinel chitty_id, expect 404 or 502
// passthrough), shape of error envelope.
//
// Per chittycanon://gov/governance#core-types — caller is Person (P); the
// chittyId being looked up may reference any of P/L/T/E/A. All five enumerated
// in env.ts.

import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { registerEvidenceLedgerRoutes } from "../src/routes/evidence-ledger";
import type { ChittyAuthClaims, Env } from "../src/env";

const CALLER = "01-A-CHT-ASST-P-5T-1-X";
// Canonical-shape chittyId that should not exist on the live ledger — used to
// exercise the real 404 / upstream-error path without mocking.
const NONEXISTENT = "ZZ-Z-ZZZ-ZZZZ-T-ZZ-Z-Z";

function claims(): ChittyAuthClaims {
  const now = Math.floor(Date.now() / 1000);
  return {
    iss: "https://auth.chitty.cc",
    sub: CALLER,
    chitty_id: CALLER,
    entity_type: "P",
    trust_level: 3,
    exp: now + 3600,
    iat: now,
    email: "phase2c@chitty.cc",
  };
}

function buildApp(envOverrides: Partial<Env> = {}) {
  const stubEnv = {
    ENVIRONMENT: "development" as const,
    CHITTYAUTH_ISSUER: "https://auth.chitty.cc",
    CHITTYAUTH_JWKS_URL: "https://auth.chitty.cc/.well-known/jwks.json",
    CHITTYAUTH_AUDIENCE: "chittyassets-api",
    CHITTYLEDGER_URL: "https://ledger.chitty.cc",
    CHITTYASSETS_DB: undefined as unknown as Hyperdrive,
    ...envOverrides,
  } as Env;

  const app = new Hono<{
    Bindings: Env;
    Variables: { claims: ChittyAuthClaims };
  }>();
  app.use("*", async (c, next) => {
    Object.defineProperty(c, "env", { get: () => stubEnv, configurable: true });
    c.set("claims", claims());
    await next();
  });
  const api = new Hono<{
    Bindings: Env;
    Variables: { claims: ChittyAuthClaims };
  }>();
  registerEvidenceLedgerRoutes(api, async (_c, next) => {
    await next();
  });
  app.route("/api", api);
  return app;
}

describe("GET /api/evidence-ledger/:chittyId — Phase 2c", () => {
  it("400 — rejects malformed chittyId without calling upstream", async () => {
    const app = buildApp();
    const res = await app.request("/api/evidence-ledger/not-a-valid-id");
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("invalid_chitty_id");
  });

  it("404 or 502 — real call against live ledger for nonexistent canonical ID", async () => {
    // Real network call to https://ledger.chitty.cc — no mocks.
    // We accept either: 404 (ledger responded with not-found, which we map to 404),
    // 502 (ledger unreachable / 5xx / network — also valid real behavior).
    const app = buildApp();
    const res = await app.request(`/api/evidence-ledger/${NONEXISTENT}`);
    expect([404, 502]).toContain(res.status);
    const body = (await res.json()) as { error: string };
    expect(typeof body.error).toBe("string");
    expect(["not_found", "ledger_unavailable"]).toContain(body.error);
  }, 15000);

  it("502 — points-at unreachable host returns ledger_unavailable", async () => {
    // Real call to a non-routable URL — exercises timeout / fetch-error path.
    const app = buildApp({
      CHITTYLEDGER_URL: "https://ledger-does-not-exist.chitty-invalid-tld",
    });
    const res = await app.request(`/api/evidence-ledger/${NONEXISTENT}`);
    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("ledger_unavailable");
  }, 10000);
});
