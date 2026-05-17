// @canon: chittycanon://core/services/chittyassets
// Ecosystem-status read route — Phase 2c of Express→Hono migration.
//
// Route ported (GET only — external HTTP fan-out):
//   GET /api/ecosystem/status   server/routes.ts:105
//
// Per chittycanon://gov/governance#core-types — ecosystem services are
// Authority (A) bearers (they issue/verify credentials, decisions, attestations
// across Persons (P), Locations (L), Things (T), and Events (E)). This endpoint
// reports Authority availability; it makes no claim about any P/L/T/E entity.
// All five entity types P/L/T/E/A remain enumerated in env.ts.

import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { requireChittyAuth } from "../auth";
import type { Env, ChittyAuthClaims } from "../env";
import { getEcosystemStatus } from "../clients/ecosystem";

type Variables = { claims: ChittyAuthClaims };
type AppType = { Bindings: Env; Variables: Variables };

export function registerEcosystemRoutes(
  app: Hono<AppType>,
  authMiddleware: MiddlewareHandler<AppType>,
) {
  app.get("/ecosystem/status", authMiddleware, async (c) => {
    const status = await getEcosystemStatus(c.env);
    // Degraded ecosystem still returns 200 — the response body reflects which
    // services are reachable. This matches the original Express semantics where
    // partial failures were surfaced in the payload, not as HTTP errors.
    return c.json(status);
  });
}

export const ecosystemRoutes = (() => {
  const r = new Hono<AppType>();
  registerEcosystemRoutes(r, requireChittyAuth);
  return r;
})();
