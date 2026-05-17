// @canon: chittycanon://core/services/chittyassets
// Insurance routes — Phase 2b reads + Phase 3b writes of Express→Hono migration.
//
// Routes:
//   GET  /api/assets/:assetId/insurance   server/routes.ts:497  (Phase 2b)
//   POST /api/assets/:assetId/insurance   server/routes.ts:508  (Phase 3b)
//
// Per chittycanon://gov/governance#core-types — insurance policies are Thing (T)
// artifacts bound to a Person (P) owner via user_id (canonical chitty_id).
// All five entity types P/L/T/E/A remain enumerated in env.ts.
//
// Ownership: insurance_policies.userId === claims.chitty_id. For writes, parent
// asset ownership is verified inside the same transaction (SELECT-then-INSERT)
// before the policy is inserted — mirrors the Phase 3a evidence pattern.
// Express version emits no timeline_events for policy creates; preserved here.

import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { and, eq, desc } from "drizzle-orm";
import { z } from "zod";
import {
  assets,
  insurancePolicies,
  insertInsurancePolicySchema,
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
const INSURANCE_SERVER_OWNED = {
  userId: true,
  assetId: true,
  chittyId: true,
} as const;

// Drizzle-zod emits z.date() for timestamp columns; JSON carries ISO strings.
const createInsuranceInputSchema = insertInsurancePolicySchema
  .omit(INSURANCE_SERVER_OWNED)
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

  // -----------------------------------------------------------------
  // POST /api/assets/:assetId/insurance — attach policy to an asset.
  // Mirrors Express server/routes.ts:508.
  //
  // 400 on bad UUID or invalid body. 404 if asset not owned. 201 on success.
  // -----------------------------------------------------------------
  app.post("/assets/:assetId/insurance", authMiddleware, async (c) => {
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

    const parsed = createInsuranceInputSchema.safeParse(body);
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
        .insert(insurancePolicies)
        .values({ ...parsed.data, assetId, userId })
        .returning();

      return { notFound: false as const, policy: inserted };
    });

    if (result.notFound) {
      return c.json({ message: "Asset not found" }, 404);
    }
    return c.json(result.policy, 201);
  });
}

export const insuranceRoutes = (() => {
  const r = new Hono<AppType>();
  registerInsuranceRoutes(r, requireChittyAuth);
  return r;
})();
