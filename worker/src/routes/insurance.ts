// @canon: chittycanon://core/services/chittyassets
// Insurance read routes — Phase 2b of Express→Hono migration.
//
// Routes ported (GET only — read-only):
//   GET /api/assets/:assetId/insurance   server/routes.ts:497
//
// Per chittycanon://gov/governance#core-types — insurance policies are Thing (T)
// artifacts bound to a Person (P) owner via user_id (canonical chitty_id).
// All five entity types P/L/T/E/A remain enumerated in env.ts.
//
// Ownership: insurance_policies.userId === claims.chitty_id (direct, no JOIN).

import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { and, eq, desc } from "drizzle-orm";
import { insurancePolicies } from "@shared/schema";
import { requireChittyAuth } from "../auth";
import { getDb } from "../db";
import type { Env, ChittyAuthClaims } from "../env";

type Variables = { claims: ChittyAuthClaims };
type AppType = { Bindings: Env; Variables: Variables };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidId(id: string): boolean {
  return UUID_RE.test(id);
}

export function registerInsuranceRoutes(
  app: Hono<AppType>,
  authMiddleware: MiddlewareHandler<AppType>,
) {
  // -----------------------------------------------------------------
  // GET /api/assets/:assetId/insurance — insurance policies for one asset
  // Mirrors storage.ts:getAssetInsurance (311-317)
  // 400 on bad UUID; ownership-scoped via insurance_policies.userId.
  // Empty list (200) for intruder — no existence leak.
  // -----------------------------------------------------------------
  app.get("/assets/:assetId/insurance", authMiddleware, async (c) => {
    const claims = c.get("claims");
    const userId = claims.chitty_id;
    const { assetId } = c.req.param();

    if (!isValidId(assetId)) {
      return c.json(
        { error: "invalid_id", message: "Asset ID must be a valid UUID" },
        400,
      );
    }

    const db = getDb(c.env.CHITTYASSETS_DB.connectionString);
    const rows = await db
      .select()
      .from(insurancePolicies)
      .where(
        and(
          eq(insurancePolicies.assetId, assetId),
          eq(insurancePolicies.userId, userId),
        ),
      )
      .orderBy(desc(insurancePolicies.endDate));

    return c.json(rows);
  });
}

export const insuranceRoutes = (() => {
  const r = new Hono<AppType>();
  registerInsuranceRoutes(r, requireChittyAuth);
  return r;
})();
