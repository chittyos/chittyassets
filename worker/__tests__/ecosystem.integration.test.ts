// @canon: chittycanon://core/services/chittyassets
// Integration tests for Phase 2c ecosystem-status fan-out.
// REAL HTTP — no mocks. Hits the live *.chitty.cc/health endpoints in parallel.
//
// Per chittycanon://gov/governance#core-types — ecosystem services are
// Authority (A) bearers. Caller is Person (P). All five P/L/T/E/A enumerated
// in env.ts.

import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { registerEcosystemRoutes } from "../src/routes/ecosystem";
import type { ChittyAuthClaims, Env } from "../src/env";

const CALLER = "01-A-CHT-ASST-P-5T-1-X";

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
  registerEcosystemRoutes(api, async (_c, next) => {
    await next();
  });
  app.route("/api", api);
  return app;
}

const EXPECTED_SERVICES = [
  "chittyid",
  "chittyassets",
  "chittytrust",
  "chittyresolution",
  "chittyfile",
];

interface ServiceRow {
  service: string;
  url: string;
  reachable: boolean;
  http_status: number | null;
  latency_ms: number | null;
  health: Record<string, unknown> | null;
  error: string | null;
}
interface EcoBody {
  ok: boolean;
  checked_at: string;
  services: ServiceRow[];
  summary: { total: number; reachable: number; unreachable: number };
}

describe("GET /api/ecosystem/status — Phase 2c (live HTTP fan-out)", () => {
  it("200 — fans out to 5 services, returns aggregated status", async () => {
    const app = buildApp();
    const res = await app.request("/api/ecosystem/status");
    expect(res.status).toBe(200);
    const body = (await res.json()) as EcoBody;

    expect(Array.isArray(body.services)).toBe(true);
    expect(body.services.length).toBe(5);
    expect(body.services.map((s) => s.service).sort()).toEqual(
      [...EXPECTED_SERVICES].sort(),
    );
    // Summary is internally consistent.
    expect(body.summary.total).toBe(5);
    expect(body.summary.reachable + body.summary.unreachable).toBe(5);
    expect(body.summary.reachable).toBe(
      body.services.filter((s) => s.reachable).length,
    );
    // ok flag mirrors all-reachable.
    expect(body.ok).toBe(body.summary.reachable === 5);
    // checked_at is a valid ISO timestamp.
    expect(() => new Date(body.checked_at).toISOString()).not.toThrow();
    // Each row has the expected shape.
    for (const s of body.services) {
      expect(typeof s.url).toBe("string");
      expect(s.url).toMatch(/\/health$/);
      expect(typeof s.reachable).toBe("boolean");
    }
  }, 15000);

  it("200 — unreachable hosts produce per-service error context (degraded ok=false)", async () => {
    const app = buildApp({
      CHITTYID_URL: "https://invalid-id-host.chitty-invalid-tld",
      CHITTYASSETS_URL: "https://invalid-assets-host.chitty-invalid-tld",
      CHITTYTRUST_URL: "https://invalid-trust-host.chitty-invalid-tld",
      CHITTYRESOLUTION_URL: "https://invalid-resolution-host.chitty-invalid-tld",
      CHITTYFILE_URL: "https://invalid-file-host.chitty-invalid-tld",
    });
    const res = await app.request("/api/ecosystem/status");
    expect(res.status).toBe(200);
    const body = (await res.json()) as EcoBody;
    expect(body.ok).toBe(false);
    expect(body.summary.unreachable).toBe(5);
    for (const s of body.services) {
      expect(s.reachable).toBe(false);
      expect(s.error).not.toBeNull();
    }
  }, 15000);
});
