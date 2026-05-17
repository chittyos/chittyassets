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
import { z } from "zod";
import {
  assets,
  evidence,
  timelineEvents,
  insertAssetSchema,
} from "@shared/schema";
import { requireChittyAuth } from "../auth";
import { getDb } from "../db";
import type { Env, ChittyAuthClaims } from "../env";
import {
  freezeAsset,
  mintAssetToken,
  MintClientError,
} from "../clients/chittymint";
import {
  calculateTrustScore,
  OpenAIClientError,
  OpenAIConfigError,
} from "../clients/openai";

// -----------------------------------------------------------------
// Input validation schemas — server-controlled fields are stripped.
// Security boundary: client CANNOT set userId, chittyId, trustScore,
// blockchain state, or verification flags. Those are server-owned.
// @canon: chittycanon://core/services/chittyassets
// -----------------------------------------------------------------
const SERVER_OWNED = {
  userId: true,
  chittyId: true,
  chittyIdV2: true,
  trustScore: true,
  blockchainHash: true,
  blockNumber: true,
  ipfsHash: true,
  freezeTimestamp: true,
  settlementTimestamp: true,
  mintingFee: true,
  verificationStatus: true,
  chittyChainStatus: true,
  deletedAt: true,
} as const;

const createAssetInputSchema = insertAssetSchema.omit(SERVER_OWNED);
const updateAssetInputSchema = createAssetInputSchema.partial();

function formatZodError(err: z.ZodError) {
  return {
    error: "invalid_input",
    message: "Request body failed validation",
    errors: err.errors.map((e) => ({
      path: e.path.join("."),
      message: e.message,
      code: e.code,
    })),
  };
}

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

  // -----------------------------------------------------------------
  // POST /api/assets — create asset (Phase 3a write)
  // Mirrors Express server/routes.ts:259
  //
  // Server-controlled fields (userId, chittyId, trustScore, chain state) are
  // injected — client cannot override. ChittyID minting + trust calc are
  // DEFERRED to an async minter pass (documented divergence from Express);
  // here we leave chittyId NULL and trustScore at schema default '0.0'.
  //
  // Side effect: append timeline_events row (event_type='acquisition') in
  // the same DB transaction as the asset INSERT.
  // -----------------------------------------------------------------
  app.post("/assets", authMiddleware, async (c) => {
    const claims = c.get("claims");
    const userId = claims.chitty_id;

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json(
        { error: "invalid_json", message: "Request body must be valid JSON" },
        400,
      );
    }

    const parsed = createAssetInputSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(formatZodError(parsed.error), 400);
    }

    const db = getDb(c.env.CHITTYASSETS_DB.connectionString);
    const inserted = await db.transaction(async (tx) => {
      const [asset] = await tx
        .insert(assets)
        .values({ ...parsed.data, userId })
        .returning();

      await tx.insert(timelineEvents).values({
        assetId: asset.id,
        userId,
        eventType: "acquisition",
        title: `Asset "${asset.name}" added to portfolio`,
        description:
          "Initial asset registration (chittyId minting deferred to async pass)",
        eventDate: new Date(),
      });

      return asset;
    });

    return c.json(inserted, 201);
  });

  // -----------------------------------------------------------------
  // PUT /api/assets/:id — update asset (ownership-checked)
  // Mirrors Express server/routes.ts:306
  //
  // Ownership enforced via UPDATE ... WHERE id=? AND user_id=? RETURNING *.
  // 0 rows returned → 404 (not 403 — no existence leak).
  // Server-owned fields cannot be overwritten by client.
  // -----------------------------------------------------------------
  app.put("/assets/:id", authMiddleware, async (c) => {
    const claims = c.get("claims");
    const userId = claims.chitty_id;
    const { id } = c.req.param();

    if (!isValidId(id)) {
      return c.json(
        { error: "invalid_id", message: "Asset ID must be a valid UUID" },
        400,
      );
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json(
        { error: "invalid_json", message: "Request body must be valid JSON" },
        400,
      );
    }

    const parsed = updateAssetInputSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(formatZodError(parsed.error), 400);
    }

    const db = getDb(c.env.CHITTYASSETS_DB.connectionString);
    const [updated] = await db
      .update(assets)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(assets.id, id), eq(assets.userId, userId)))
      .returning();

    if (!updated) {
      return c.json({ message: "Asset not found" }, 404);
    }
    return c.json(updated);
  });

  // -----------------------------------------------------------------
  // DELETE /api/assets/:id — delete asset (ownership-checked)
  // Mirrors Express server/routes.ts:323
  //
  // Returns 204 on success, 404 if not owned/not-found. Hard delete to
  // match Express semantics; soft-delete (deleted_at) is a future change.
  // -----------------------------------------------------------------
  app.delete("/assets/:id", authMiddleware, async (c) => {
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
    // Cascade: timeline_events and evidence FK assets.id. Delete dependents
    // first within a transaction to avoid FK violation.
    const deleted = await db.transaction(async (tx) => {
      const [owned] = await tx
        .select({ id: assets.id })
        .from(assets)
        .where(and(eq(assets.id, id), eq(assets.userId, userId)));
      if (!owned) return null;

      await tx
        .delete(timelineEvents)
        .where(
          and(
            eq(timelineEvents.assetId, id),
            eq(timelineEvents.userId, userId),
          ),
        );
      await tx
        .delete(evidence)
        .where(and(eq(evidence.assetId, id), eq(evidence.userId, userId)));
      const [row] = await tx
        .delete(assets)
        .where(and(eq(assets.id, id), eq(assets.userId, userId)))
        .returning({ id: assets.id });
      return row ?? null;
    });

    if (!deleted) {
      return c.json({ message: "Asset not found" }, 404);
    }
    return c.body(null, 204);
  });

  // -----------------------------------------------------------------
  // POST /api/assets/:id/freeze — Phase 3c
  // Mirrors Express server/routes.ts:125. Calls ChittyMint freeze endpoint,
  // updates asset row to {chittyChainStatus:'frozen', ipfsHash, freezeTimestamp},
  // and emits a timeline_events row in the same transaction.
  // -----------------------------------------------------------------
  app.post("/assets/:id/freeze", authMiddleware, async (c) => {
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
    if (!asset) return c.json({ message: "Asset not found" }, 404);

    // External freeze — failures are surfaced as 502.
    let freezeResult;
    try {
      freezeResult = await freezeAsset(
        c.env,
        asset.chittyId ?? asset.id,
        asset,
      );
    } catch (err) {
      if (err instanceof MintClientError) {
        return c.json(
          {
            error: "mint_unavailable",
            message: err.message,
            upstream_status: err.status,
          },
          502,
        );
      }
      throw err;
    }

    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(assets)
        .set({
          chittyChainStatus: "frozen",
          ipfsHash: freezeResult.ipfsHash ?? null,
          freezeTimestamp: freezeResult.freezeTimestamp
            ? new Date(freezeResult.freezeTimestamp)
            : new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(assets.id, id), eq(assets.userId, userId)))
        .returning();
      if (!row) return null;
      await tx.insert(timelineEvents).values({
        assetId: row.id,
        userId,
        eventType: "other",
        title: "Asset frozen on ChittyChain",
        description: "7-day immutability period started",
        eventDate: new Date(),
      });
      return row;
    });

    if (!updated) return c.json({ message: "Asset not found" }, 404);
    return c.json(updated);
  });

  // -----------------------------------------------------------------
  // POST /api/assets/:id/mint — Phase 3c
  // Mirrors Express server/routes.ts:166. Gate: chittyChainStatus === 'frozen'
  // (matches Express; the "7 days elapsed" check is aspirational and NOT in
  // Express today). Calls ChittyMint mint endpoint, updates asset row.
  //
  // NOTE: This endpoint mints an evidence TOKEN, not the ChittyID itself.
  // Phase 3a's chitty_id=NULL deferral is NOT resolved here — see PR body.
  // -----------------------------------------------------------------
  app.post("/assets/:id/mint", authMiddleware, async (c) => {
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
    if (!asset) return c.json({ message: "Asset not found" }, 404);

    if (asset.chittyChainStatus !== "frozen") {
      return c.json(
        {
          error: "invalid_state",
          message: "Asset must be frozen before minting",
          current_status: asset.chittyChainStatus,
        },
        400,
      );
    }

    let mintResult;
    try {
      mintResult = await mintAssetToken(
        c.env,
        asset.chittyId ?? asset.id,
        asset.ipfsHash ?? "placeholder",
      );
    } catch (err) {
      if (err instanceof MintClientError) {
        return c.json(
          {
            error: "mint_unavailable",
            message: err.message,
            upstream_status: err.status,
          },
          502,
        );
      }
      throw err;
    }

    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(assets)
        .set({
          chittyChainStatus: "minted",
          blockchainHash: mintResult.transactionHash ?? null,
          mintingFee: "0.1",
          updatedAt: new Date(),
        })
        .where(and(eq(assets.id, id), eq(assets.userId, userId)))
        .returning();
      if (!row) return null;
      await tx.insert(timelineEvents).values({
        assetId: row.id,
        userId,
        eventType: "other",
        title: "Evidence token minted",
        description: "Asset ownership token created on ChittyChain",
        eventDate: new Date(),
      });
      return row;
    });

    if (!updated) return c.json({ message: "Asset not found" }, 404);
    return c.json(updated);
  });

  // -----------------------------------------------------------------
  // POST /api/assets/:assetId/calculate-trust-score — Phase 3c
  // Mirrors Express server/routes.ts:596. Express delegates to
  // aiAnalysisService.calculateTrustScore which calls OpenAI (NOT
  // ChittyTrust — divergence from the migration spec, preserved to match
  // Express semantics verbatim).
  //
  // assets.trust_score column is numeric(3,1) — max representable is 99.9.
  // The OpenAI response is clamped to [0, 99.9] before UPDATE.
  // -----------------------------------------------------------------
  app.post("/assets/:assetId/calculate-trust-score", authMiddleware, async (c) => {
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
    const [asset] = await db
      .select()
      .from(assets)
      .where(and(eq(assets.id, assetId), eq(assets.userId, userId)));
    if (!asset) return c.json({ message: "Asset not found" }, 404);

    const evidenceRows = await db
      .select()
      .from(evidence)
      .where(
        and(eq(evidence.assetId, assetId), eq(evidence.userId, userId)),
      );

    let result;
    try {
      result = await calculateTrustScore(c.env, asset, evidenceRows);
    } catch (err) {
      if (err instanceof OpenAIConfigError) {
        return c.json(
          {
            error: "service_unavailable",
            message: "OPENAI_API_KEY not configured",
          },
          503,
        );
      }
      if (err instanceof OpenAIClientError) {
        return c.json(
          {
            error: "openai_unavailable",
            message: err.message,
            upstream_status: err.status,
          },
          502,
        );
      }
      throw err;
    }

    // numeric(3,1) max is 99.9; clamp to keep INSERT/UPDATE valid.
    const clamped = Math.min(99.9, Math.max(0, result.trustScore));
    await db
      .update(assets)
      .set({ trustScore: clamped.toFixed(1), updatedAt: new Date() })
      .where(and(eq(assets.id, assetId), eq(assets.userId, userId)));

    return c.json({ trustScore: clamped, factors: result.factors });
  });
}

// Production sub-app with real auth middleware.
export const assetRoutes = (() => {
  const r = new Hono<AppType>();
  registerAssetRoutes(r, requireChittyAuth);
  return r;
})();
