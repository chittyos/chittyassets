// @canon: chittycanon://core/services/chittyassets
// Evidence write routes — Phase 3a of Express→Hono migration.
//
// Per chittycanon://gov/governance#core-types — all five entity types
// (P/L/T/E/A) are recognized by this service. Evidence is a Thing (T),
// uploaded by a Person (P), recorded as an Event (E) on the timeline.
// Authority (A) and Location (L) are not exercised by this route but the
// type system enumerates them (see worker/src/env.ts ENTITY_TYPES).
//
// Routes ported:
//   POST /api/assets/:assetId/evidence    server/routes.ts:346
//
// Ownership: parent asset is verified inside the same transaction
// (SELECT ... WHERE id=assetId AND user_id=claims.chitty_id) before the
// evidence row is inserted. 404 on mismatch (no existence leak).
//
// Side effect: timeline_events row (event_type='evidence_added') inserted
// in the same transaction as the evidence INSERT.

import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import {
  assets,
  evidence,
  aiAnalysisResults,
  timelineEvents,
  insertEvidenceSchema,
} from "@shared/schema";
import { requireChittyAuth } from "../auth";
import { getDb } from "../db";
import type { Env, ChittyAuthClaims } from "../env";
import {
  analyzeReceipt,
  analyzeDocument,
  analyzeAssetPhoto,
  OpenAIClientError,
  OpenAIConfigError,
} from "../clients/openai";

type Variables = { claims: ChittyAuthClaims };
type AppType = { Bindings: Env; Variables: Variables };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidId(id: string): boolean {
  return UUID_RE.test(id);
}

// Server-controlled: client cannot set userId, assetId (from URL), chittyId,
// blockchainHash, or verificationStatus. AI fields are also server-owned.
const EVIDENCE_SERVER_OWNED = {
  userId: true,
  assetId: true,
  chittyId: true,
  blockchainHash: true,
  verificationStatus: true,
  aiAnalysis: true,
  deletedAt: true,
} as const;

const createEvidenceInputSchema = insertEvidenceSchema.omit(
  EVIDENCE_SERVER_OWNED,
);

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

export function registerEvidenceRoutes(
  app: Hono<AppType>,
  authMiddleware: MiddlewareHandler<AppType>,
) {
  // -----------------------------------------------------------------
  // POST /api/assets/:assetId/evidence — attach evidence to an asset.
  // 400 on bad UUID or invalid body. 404 if asset not owned. 201 on success.
  // -----------------------------------------------------------------
  app.post("/assets/:assetId/evidence", authMiddleware, async (c) => {
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

    const parsed = createEvidenceInputSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(formatZodError(parsed.error), 400);
    }

    const db = getDb(c.env.CHITTYASSETS_DB.connectionString);
    const result = await db.transaction(async (tx) => {
      // Ownership check inside transaction — parent asset must belong to caller.
      const [owned] = await tx
        .select({ id: assets.id })
        .from(assets)
        .where(and(eq(assets.id, assetId), eq(assets.userId, userId)));
      if (!owned) return { notFound: true as const };

      const [inserted] = await tx
        .insert(evidence)
        .values({ ...parsed.data, assetId, userId })
        .returning();

      await tx.insert(timelineEvents).values({
        assetId,
        userId,
        eventType: "evidence_added",
        title: `Evidence "${inserted.name}" added`,
        description: `New ${inserted.evidenceType} evidence uploaded`,
        eventDate: new Date(),
        relatedEvidenceId: inserted.id,
      });

      return { notFound: false as const, evidence: inserted };
    });

    if (result.notFound) {
      return c.json({ message: "Asset not found" }, 404);
    }
    return c.json(result.evidence, 201);
  });

  // -----------------------------------------------------------------
  // POST /api/evidence/:evidenceId/analyze — Phase 3c
  // Mirrors Express server/routes.ts:379. Routes to OpenAI gpt-4o based on
  // analysisType ('receipt' | 'document' | 'asset_valuation'). Stores result
  // in ai_analysis_results (Event E) and updates evidence row with the
  // analysis JSON + verificationStatus.
  // -----------------------------------------------------------------
  app.post("/evidence/:evidenceId/analyze", authMiddleware, async (c) => {
    const claims = c.get("claims");
    const userId = claims.chitty_id;
    const { evidenceId } = c.req.param();

    if (!isValidId(evidenceId)) {
      return c.json(
        { error: "invalid_id", message: "Evidence ID must be a valid UUID" },
        400,
      );
    }

    let body: any;
    try {
      body = await c.req.json();
    } catch {
      return c.json(
        { error: "invalid_json", message: "Request body must be valid JSON" },
        400,
      );
    }

    const { base64Image, analysisType } = body ?? {};
    if (!base64Image || !analysisType) {
      return c.json(
        {
          error: "invalid_input",
          message: "base64Image and analysisType are required",
        },
        400,
      );
    }
    if (
      analysisType !== "receipt" &&
      analysisType !== "document" &&
      analysisType !== "asset_valuation"
    ) {
      return c.json(
        { error: "invalid_input", message: "Invalid analysis type" },
        400,
      );
    }

    const db = getDb(c.env.CHITTYASSETS_DB.connectionString);

    // Ownership check — evidence must belong to caller.
    const [evidenceItem] = await db
      .select()
      .from(evidence)
      .where(and(eq(evidence.id, evidenceId), eq(evidence.userId, userId)));
    if (!evidenceItem) {
      return c.json({ message: "Evidence not found" }, 404);
    }

    const startTime = Date.now();
    let results: any;
    let confidence = 0;
    try {
      if (analysisType === "receipt") {
        results = await analyzeReceipt(c.env, base64Image);
      } else if (analysisType === "document") {
        results = await analyzeDocument(c.env, base64Image);
      } else {
        const [asset] = await db
          .select()
          .from(assets)
          .where(
            and(
              eq(assets.id, evidenceItem.assetId),
              eq(assets.userId, userId),
            ),
          );
        results = await analyzeAssetPhoto(
          c.env,
          base64Image,
          asset?.assetType ?? "unknown",
        );
      }
      confidence = typeof results?.confidence === "number" ? results.confidence : 0;
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
    const processingTime = Date.now() - startTime;
    // ai_analysis_results.confidence is numeric(3,2) — max 9.99, range 0..1.
    const confidenceStr = Math.max(0, Math.min(1, confidence)).toFixed(2);

    const inserted = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(aiAnalysisResults)
        .values({
          evidenceId,
          analysisType,
          confidence: confidenceStr,
          results,
          processingTime,
          modelUsed: "gpt-4o",
        })
        .returning();
      await tx
        .update(evidence)
        .set({
          aiAnalysis: results,
          verificationStatus: confidence > 0.8 ? "verified" : "pending",
          updatedAt: new Date(),
        })
        .where(and(eq(evidence.id, evidenceId), eq(evidence.userId, userId)));
      return row;
    });

    return c.json(inserted);
  });
}

// Production sub-app with real auth middleware.
export const evidenceRoutes = (() => {
  const r = new Hono<AppType>();
  registerEvidenceRoutes(r, requireChittyAuth);
  return r;
})();
