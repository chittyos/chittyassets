// @canon: chittycanon://core/services/chittyassets
// Warranty read routes — Phase 2b of Express→Hono migration.
//
// Routes ported (GET only — read-only):
//   GET /api/assets/:assetId/warranties   server/routes.ts:453
//   GET /api/warranties/expiring          server/routes.ts:464
//
// Per chittycanon://gov/governance#core-types — warranties are Thing (T)
// artifacts bound to a Person (P) owner via user_id (canonical chitty_id).
// All five entity types P/L/T/E/A remain enumerated in env.ts; this module
// touches Person (owner) + Thing (warranty contract).
//
// Ownership: warranties.userId === claims.chitty_id (direct, no JOIN needed —
// warranties.user_id is denormalized on insert by the writer side).

import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { and, eq, gte, lte, desc } from "drizzle-orm";
import { warranties } from "@shared/schema";
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

/**
 * Register warranty read routes on the given Hono app.
 * Accepts an auth middleware so integration tests can inject claims directly.
 */
export function registerWarrantyRoutes(
  app: Hono<AppType>,
  authMiddleware: MiddlewareHandler<AppType>,
) {
  // -----------------------------------------------------------------
  // GET /api/warranties/expiring?days=N — active warranties expiring soon
  // Registered BEFORE the parameterized route to avoid ambiguity.
  // Mirrors storage.ts:getExpiringWarranties (278-294)
  // -----------------------------------------------------------------
  app.get("/warranties/expiring", authMiddleware, async (c) => {
    const claims = c.get("claims");
    const userId = claims.chitty_id;
    const daysRaw = c.req.query("days");
    const parsed = daysRaw ? parseInt(daysRaw, 10) : 30;
    const daysAhead = Number.isFinite(parsed) && parsed > 0 ? parsed : 30;

    const now = new Date();
    const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    const db = getDb(c.env.CHITTYASSETS_DB.connectionString);
    const rows = await db
      .select()
      .from(warranties)
      .where(
        and(
          eq(warranties.userId, userId),
          eq(warranties.isActive, true),
          lte(warranties.endDate, futureDate),
          gte(warranties.endDate, now),
        ),
      )
      .orderBy(warranties.endDate);

    return c.json(rows);
  });

  // -----------------------------------------------------------------
  // GET /api/assets/:assetId/warranties — warranties for one asset
  // Mirrors storage.ts:getAssetWarranties (270-276)
  // 400 on bad UUID; ownership-scoped via warranties.userId.
  // Empty list (200) for intruder — no existence leak.
  // -----------------------------------------------------------------
  app.get("/assets/:assetId/warranties", authMiddleware, async (c) => {
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
      .from(warranties)
      .where(
        and(eq(warranties.assetId, assetId), eq(warranties.userId, userId)),
      )
      .orderBy(desc(warranties.endDate));

    return c.json(rows);
  });
}

// Production sub-app with real auth middleware.
export const warrantyRoutes = (() => {
  const r = new Hono<AppType>();
  registerWarrantyRoutes(r, requireChittyAuth);
  return r;
})();
