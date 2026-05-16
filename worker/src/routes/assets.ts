// @canon: chittycanon://core/services/chittyassets
// Asset read routes — Phase 2a of Express→Hono migration.
//
// Ownership key decision (documented for PR review):
//   Express (Replit Auth era): assets.userId === "chitty_" + req.auth.userId
//   Hono (ChittyAuth era):     assets.userId === claims.chitty_id (canonical VV-G-LLL-SSSS-P-YM-C-X)
//   This is an intentional semantic alignment. ChittyAuth tokens carry chitty_id directly;
//   the "chitty_" prefix was a Replit Auth workaround. Seed data and prod data must use
//   the canonical chitty_id as assets.user_id.
//
// Per chittycanon://gov/governance#core-types — entities are one of P/L/T/E/A.
// Users in this service are Person (P) entities.
//
// Routes ported (GET only — read-only Phase 2a):
//   GET /api/assets                       server/routes.ts:215
//   GET /api/assets/stats                 server/routes.ts:234
//   GET /api/assets/:id                   server/routes.ts:245
//   GET /api/assets/:assetId/evidence     server/routes.ts:335
//   GET /api/assets/:assetId/timeline     server/routes.ts:441

import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { eq, and, desc, gte, lte, sql } from "drizzle-orm";
import { assets, evidence, timelineEvents } from "@shared/schema";
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
 * Register all 5 asset read routes on the given Hono app.
 * Accepts an auth middleware so integration tests can inject claims directly.
 */
export function registerAssetRoutes(
  app: Hono<AppType>,
  authMiddleware: MiddlewareHandler<AppType>,
) {
  // -----------------------------------------------------------------
  // GET /api/assets — list user's assets with optional filters
  // Mirrors storage.ts:getUserAssets (130-170)
  // -----------------------------------------------------------------
  app.get("/assets", authMiddleware, async (c) => {
    const claims = c.get("claims");
    const userId = claims.chitty_id;
    const db = getDb(c.env.CHITTYASSETS_DB.connectionString);

    const assetType = c.req.query("type");
    const status = c.req.query("status");
    const searchTerm = c.req.query("search");
    const minValueRaw = c.req.query("minValue");
    const maxValueRaw = c.req.query("maxValue");
    const minValue = minValueRaw ? parseFloat(minValueRaw) : undefined;
    const maxValue = maxValueRaw ? parseFloat(maxValueRaw) : undefined;

    const conditions = [eq(assets.userId, userId)];

    if (assetType) {
      conditions.push(eq(assets.assetType, assetType as any));
    }
    if (status) {
      conditions.push(eq(assets.status, status as any));
    }
    if (searchTerm) {
      conditions.push(
        sql`(${assets.name} ILIKE ${`%${searchTerm}%`} OR ${assets.description} ILIKE ${`%${searchTerm}%`})`,
      );
    }
    if (minValue !== undefined && !isNaN(minValue)) {
      conditions.push(gte(assets.currentValue, minValue.toString()));
    }
    if (maxValue !== undefined && !isNaN(maxValue)) {
      conditions.push(lte(assets.currentValue, maxValue.toString()));
    }

    const rows = await db
      .select()
      .from(assets)
      .where(and(...conditions))
      .orderBy(desc(assets.createdAt));

    return c.json(rows);
  });

  // -----------------------------------------------------------------
  // GET /api/assets/stats — aggregated counts/values
  // Mirrors storage.ts:getAssetStats (185-213)
  // Registered BEFORE /:id so Hono router does not match "stats" as :id.
  // -----------------------------------------------------------------
  app.get("/assets/stats", authMiddleware, async (c) => {
    const claims = c.get("claims");
    const userId = claims.chitty_id;
    const db = getDb(c.env.CHITTYASSETS_DB.connectionString);

    const userAssets = await db
      .select()
      .from(assets)
      .where(eq(assets.userId, userId));

    const totalAssets = userAssets.length;
    const totalValue = userAssets.reduce(
      (sum, a) => sum + (a.currentValue ? parseFloat(a.currentValue) : 0),
      0,
    );
    const verifiedAssets = userAssets.filter(
      (a) => a.verificationStatus === "verified",
    ).length;
    const averageTrustScore =
      userAssets.reduce(
        (sum, a) => sum + (a.trustScore ? parseFloat(a.trustScore) : 0),
        0,
      ) / (totalAssets || 1);

    const assetsByType: Record<string, number> = {};
    const assetsByStatus: Record<string, number> = {};
    for (const a of userAssets) {
      assetsByType[a.assetType] = (assetsByType[a.assetType] ?? 0) + 1;
      assetsByStatus[a.status ?? "unknown"] =
        (assetsByStatus[a.status ?? "unknown"] ?? 0) + 1;
    }

    return c.json({
      totalAssets,
      totalValue,
      verifiedAssets,
      averageTrustScore,
      assetsByType,
      assetsByStatus,
    });
  });

  // -----------------------------------------------------------------
  // GET /api/assets/:id — single asset, ownership-checked
  // 400 on bad UUID; 404 on not-found or ownership mismatch (no existence leak).
  // Mirrors storage.ts:getAsset (122-128)
  // -----------------------------------------------------------------
  app.get("/assets/:id", authMiddleware, async (c) => {
    const claims = c.get("claims");
    const userId = claims.chitty_id;
    const { id } = c.req.param();

    if (!isValidId(id)) {
      return c.json(
        { error: "invalid_id", message: "Asset ID must be a valid UUID" },
        400,
      );
    }

    const db = getDb(c.env.CHITTYASSETS_DB.connectionString);
    const [asset] = await db
      .select()
      .from(assets)
      .where(and(eq(assets.id, id), eq(assets.userId, userId)));

    if (!asset) {
      return c.json({ message: "Asset not found" }, 404);
    }
    return c.json(asset);
  });

  // -----------------------------------------------------------------
  // GET /api/assets/:assetId/evidence — evidence list for asset
  // Mirrors storage.ts:getAssetEvidence (229-235)
  // -----------------------------------------------------------------
  app.get("/assets/:assetId/evidence", authMiddleware, async (c) => {
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
      .from(evidence)
      .where(and(eq(evidence.assetId, assetId), eq(evidence.userId, userId)))
      .orderBy(desc(evidence.createdAt));

    return c.json(rows);
  });

  // -----------------------------------------------------------------
  // GET /api/assets/:assetId/timeline — timeline events for asset
  // Mirrors storage.ts:getAssetTimeline (256-262)
  // -----------------------------------------------------------------
  app.get("/assets/:assetId/timeline", authMiddleware, async (c) => {
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
      .from(timelineEvents)
      .where(
        and(
          eq(timelineEvents.assetId, assetId),
          eq(timelineEvents.userId, userId),
        ),
      )
      .orderBy(desc(timelineEvents.eventDate));

    return c.json(rows);
  });
}

// Production sub-app with real auth middleware.
export const assetRoutes = (() => {
  const r = new Hono<AppType>();
  registerAssetRoutes(r, requireChittyAuth);
  return r;
})();
