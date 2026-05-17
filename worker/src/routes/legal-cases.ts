// @canon: chittycanon://core/services/chittyassets
// Legal-case routes — Phase 2b reads + Phase 3b writes of Express→Hono migration.
//
// Routes:
//   GET  /api/legal-cases   server/routes.ts:529  (Phase 2b)
//   POST /api/legal-cases   server/routes.ts:540  (Phase 3b)
//
// Per chittycanon://gov/governance#core-types — legal_cases are Event (E)
// proceedings owned by a Person (P) via user_id (canonical chitty_id).
// All five entity types P/L/T/E/A remain enumerated in env.ts.
//
// Ownership: legal_cases.userId === claims.chitty_id. No parent asset to
// verify — scoping is direct on user_id (the row is created with the caller's
// chitty_id). Express version emits no timeline_events for case creates;
// preserved here.

import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import {
  legalCases,
  assets,
  evidence,
  timelineEvents,
  insertLegalCaseSchema,
} from "@shared/schema";
import { requireChittyAuth } from "../auth";
import { getDb } from "../db";
import type { Env, ChittyAuthClaims } from "../env";
import {
  generateLegalDocument,
  OpenAIClientError,
  OpenAIConfigError,
} from "../clients/openai";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidId(id: string): boolean {
  return UUID_RE.test(id);
}

type Variables = { claims: ChittyAuthClaims };
type AppType = { Bindings: Env; Variables: Variables };

// Server-controlled: client cannot set userId or chittyId.
const LEGAL_CASE_SERVER_OWNED = {
  userId: true,
  chittyId: true,
} as const;

// filingDate / nextHearing are timestamps; drizzle-zod emits z.date(). JSON
// carries ISO strings, so coerce. Both are optional on the underlying table.
const createLegalCaseInputSchema = insertLegalCaseSchema
  .omit(LEGAL_CASE_SERVER_OWNED)
  .extend({
    filingDate: z.coerce.date().optional().nullable(),
    nextHearing: z.coerce.date().optional().nullable(),
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

export function registerLegalCaseRoutes(
  app: Hono<AppType>,
  authMiddleware: MiddlewareHandler<AppType>,
) {
  // -----------------------------------------------------------------
  // GET /api/legal-cases — caller's legal cases (ownership-scoped)
  // Mirrors storage.ts:getUserLegalCases (339-345)
  // -----------------------------------------------------------------
  app.get("/legal-cases", authMiddleware, async (c) => {
    const claims = c.get("claims");
    const userId = claims.chitty_id;
    const db = getDb(c.env.CHITTYASSETS_DB.connectionString);

    const rows = await db
      .select()
      .from(legalCases)
      .where(eq(legalCases.userId, userId))
      .orderBy(desc(legalCases.createdAt));

    return c.json(rows);
  });

  // -----------------------------------------------------------------
  // POST /api/legal-cases — create a new legal case for the caller.
  // Mirrors Express server/routes.ts:540.
  //
  // 400 on invalid body. 201 on success. No parent asset to verify —
  // user_id is server-injected from claims, so cross-user creation is
  // structurally impossible.
  // -----------------------------------------------------------------
  app.post("/legal-cases", authMiddleware, async (c) => {
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

    const parsed = createLegalCaseInputSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(formatZodError(parsed.error), 400);
    }

    const db = getDb(c.env.CHITTYASSETS_DB.connectionString);
    const [inserted] = await db
      .insert(legalCases)
      .values({ ...parsed.data, userId })
      .returning();

    return c.json(inserted, 201);
  });

  // -----------------------------------------------------------------
  // POST /api/legal/generate-document — Phase 3c
  // Mirrors Express server/routes.ts:557. Builds a documentData payload
  // from the asset + top-5 evidence + recent-10 timeline events, then asks
  // OpenAI gpt-4o to generate a court-ready document for the given
  // jurisdiction (default 'New York State').
  // -----------------------------------------------------------------
  app.post("/legal/generate-document", authMiddleware, async (c) => {
    const claims = c.get("claims");
    const userId = claims.chitty_id;

    let body: any;
    try {
      body = await c.req.json();
    } catch {
      return c.json(
        { error: "invalid_json", message: "Request body must be valid JSON" },
        400,
      );
    }
    const {
      templateType,
      assetId,
      jurisdiction,
      includeNotarization,
      includeBlockchain,
    } = body ?? {};
    if (!templateType || !assetId) {
      return c.json(
        {
          error: "invalid_input",
          message: "templateType and assetId are required",
        },
        400,
      );
    }
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
      .where(and(eq(evidence.assetId, assetId), eq(evidence.userId, userId)))
      .orderBy(desc(evidence.createdAt))
      .limit(5);
    const timelineRows = await db
      .select()
      .from(timelineEvents)
      .where(
        and(
          eq(timelineEvents.assetId, assetId),
          eq(timelineEvents.userId, userId),
        ),
      )
      .orderBy(desc(timelineEvents.eventDate))
      .limit(10);

    const documentData = {
      asset,
      evidence: evidenceRows,
      timeline: timelineRows,
      includeNotarization: Boolean(includeNotarization),
      includeBlockchain: Boolean(includeBlockchain),
    };

    let document: string;
    try {
      document = await generateLegalDocument(
        c.env,
        String(templateType),
        documentData,
        String(jurisdiction ?? "New York State"),
      );
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

    return c.json({
      document,
      templateType,
      jurisdiction: jurisdiction ?? "New York State",
    });
  });
}

export const legalCaseRoutes = (() => {
  const r = new Hono<AppType>();
  registerLegalCaseRoutes(r, requireChittyAuth);
  return r;
})();
