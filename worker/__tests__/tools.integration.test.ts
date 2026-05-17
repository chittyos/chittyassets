// @canon: chittycanon://core/services/chittyassets
// Integration tests for Phase 2b tool-resources read route.
// Static catalog — no DB calls. Per chittycanon://gov/governance#core-types
// the caller is Person (P) and resources surfaced are Thing (T). All five
// P/L/T/E/A enumerated in env.ts.

import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { registerToolRoutes } from "../src/routes/tools";
import type { ChittyAuthClaims, Env } from "../src/env";

const OWNER_CHITTY_ID = "01-A-CHT-ASST-P-5T-1-X";

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
    email: "tools.caller@chitty.cc",
  };
}

function buildTestApp(claimsOverride: ChittyAuthClaims) {
  const stubEnv = {
    ENVIRONMENT: "development" as const,
    CHITTYAUTH_ISSUER: "https://auth.chitty.cc",
    CHITTYAUTH_JWKS_URL: "https://auth.chitty.cc/.well-known/jwks.json",
    CHITTYAUTH_AUDIENCE: "chittyassets-api",
    // No DB binding needed — route is static.
    CHITTYASSETS_DB: undefined as unknown as Hyperdrive,
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
  registerToolRoutes(apiApp, async (_c, next) => {
    await next();
  });
  app.route("/api", apiApp);
  return app;
}

describe("GET /api/tools/resources", () => {
  it("200 — returns resource catalog with callableResources shortlist", async () => {
    const app = buildTestApp(ownerClaims());
    const res = await app.request("/api/tools/resources");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      resources: Array<{
        id: string;
        callable: boolean;
        capabilities: string[];
        category: string;
      }>;
      callableResources: string[];
    };
    expect(Array.isArray(body.resources)).toBe(true);
    expect(body.resources.length).toBe(5);
    // Each resource has the expected shape.
    for (const r of body.resources) {
      expect(typeof r.id).toBe("string");
      expect(typeof r.callable).toBe("boolean");
      expect(Array.isArray(r.capabilities)).toBe(true);
    }
    // callableResources mirrors server/toolRegistry — every resource is currently callable.
    expect(Array.isArray(body.callableResources)).toBe(true);
    expect(body.callableResources).toEqual(
      body.resources.filter((r) => r.callable).map((r) => r.id),
    );
    // Known catalog entries.
    expect(body.resources.map((r) => r.id)).toEqual(
      expect.arrayContaining([
        "cloudflare.workers.assets",
        "notion.search",
        "google.drive.search",
        "outlook.mail.search",
        "neon.metadata.search",
      ]),
    );
  });
});
