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
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import {
  legalCases,
  insertLegalCaseSchema,
} from "@shared/schema";
import { requireChittyAuth } from "../auth";
import { getDb } from "../db";
import type { Env, ChittyAuthClaims } from "../env";

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
}

export const legalCaseRoutes = (() => {
  const r = new Hono<AppType>();
  registerLegalCaseRoutes(r, requireChittyAuth);
  return r;
})();
