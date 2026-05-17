// @canon: chittycanon://core/services/chittyassets
// Legal-case read routes — Phase 2b of Express→Hono migration.
//
// Routes ported (GET only — read-only):
//   GET /api/legal-cases   server/routes.ts:529
//
// Per chittycanon://gov/governance#core-types — legal_cases are Event (E)
// proceedings owned by a Person (P) via user_id (canonical chitty_id).
// All five entity types P/L/T/E/A remain enumerated in env.ts.

import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { eq, desc } from "drizzle-orm";
import { legalCases } from "@shared/schema";
import { requireChittyAuth } from "../auth";
import { getDb } from "../db";
import type { Env, ChittyAuthClaims } from "../env";

type Variables = { claims: ChittyAuthClaims };
type AppType = { Bindings: Env; Variables: Variables };

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
}

export const legalCaseRoutes = (() => {
  const r = new Hono<AppType>();
  registerLegalCaseRoutes(r, requireChittyAuth);
  return r;
})();
