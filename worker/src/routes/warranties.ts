// @canon: chittycanon://core/services/chittyassets
// Warranty routes — Phase 2b reads + Phase 3b writes of Express→Hono migration.
//
// Routes:
//   GET  /api/assets/:assetId/warranties   server/routes.ts:453  (Phase 2b)
//   GET  /api/warranties/expiring          server/routes.ts:464  (Phase 2b)
//   POST /api/assets/:assetId/warranties   server/routes.ts:476  (Phase 3b)
//
// Per chittycanon://gov/governance#core-types — warranties are Thing (T)
// artifacts bound to a Person (P) owner via user_id (canonical chitty_id).
// All five entity types P/L/T/E/A remain enumerated in env.ts; this module
// touches Person (owner) + Thing (warranty contract).
//
// Ownership: warranties.userId === claims.chitty_id. For writes, parent asset
// ownership is verified inside the same transaction (SELECT-then-INSERT)
// before the warranty row is inserted — mirrors the Phase 3a evidence pattern.
// Express version emits no timeline_events for warranty creates; we preserve
// that behavior here (no side effects beyond the INSERT).

import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { and, eq, gte, lte, desc } from "drizzle-orm";
import { z } from "zod";
import {
  assets,
  warranties,
  insertWarrantySchema,
} from "@shared/schema";
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

// Server-controlled: client cannot set userId, assetId (from URL), or chittyId.
const WARRANTY_SERVER_OWNED = {
  userId: true,
  assetId: true,
  chittyId: true,
} as const;

// Drizzle-zod emits z.date() for timestamp columns; JSON bodies carry ISO
// strings, so we extend with coercive date fields. Express's body-parser path
// is more forgiving; we make it explicit here.
const createWarrantyInputSchema = insertWarrantySchema
  .omit(WARRANTY_SERVER_OWNED)
  .extend({
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
  });

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

/**
 * Register warranty routes on the given Hono app.
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

  // -----------------------------------------------------------------
  // POST /api/assets/:assetId/warranties — attach warranty to an asset.
  // Mirrors Express server/routes.ts:476.
  //
  // 400 on bad UUID or invalid body. 404 if asset not owned. 201 on success.
  // Ownership check inside transaction prevents toctou races and existence
  // leaks (404 looks identical to "asset doesn't exist").
  // -----------------------------------------------------------------
  app.post("/assets/:assetId/warranties", authMiddleware, async (c) => {
    const claims = c.get("claims");
    const userId = claims.chitty_id;
    const { assetId } = c.req.param();

    if (!isValidId(assetId)) {
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

    const parsed = createWarrantyInputSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(formatZodError(parsed.error), 400);
    }

    const db = getDb(c.env.CHITTYASSETS_DB.connectionString);
    const result = await db.transaction(async (tx) => {
      const [owned] = await tx
        .select({ id: assets.id })
        .from(assets)
        .where(and(eq(assets.id, assetId), eq(assets.userId, userId)));
      if (!owned) return { notFound: true as const };

      const [inserted] = await tx
        .insert(warranties)
        .values({ ...parsed.data, assetId, userId })
        .returning();

      return { notFound: false as const, warranty: inserted };
    });

    if (result.notFound) {
      return c.json({ message: "Asset not found" }, 404);
    }
    return c.json(result.warranty, 201);
  });
}

// Production sub-app with real auth middleware.
export const warrantyRoutes = (() => {
  const r = new Hono<AppType>();
  registerWarrantyRoutes(r, requireChittyAuth);
  return r;
})();
