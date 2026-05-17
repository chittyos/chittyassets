// @canon: chittycanon://core/services/chittyassets
// Evidence-ledger read route — Phase 2c of Express→Hono migration.
//
// Route ported (GET only — external HTTP read):
//   GET /api/evidence-ledger/:chittyId   server/routes.ts:80
//
// Per chittycanon://gov/governance#core-types — the chittyId path param can
// reference any of P/L/T/E/A; ChittyLedger is type-agnostic. The caller is a
// Person (P). All five entity types P/L/T/E/A remain enumerated in env.ts.

import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { requireChittyAuth } from "../auth";
import { CHITTY_ID_PATTERN, type Env, type ChittyAuthClaims } from "../env";
import {
  getEvidence,
  submitEvidence,
  verifyEvidence,
  LedgerClientError,
} from "../clients/chittyledger";

type Variables = { claims: ChittyAuthClaims };
type AppType = { Bindings: Env; Variables: Variables };

export function registerEvidenceLedgerRoutes(
  app: Hono<AppType>,
  authMiddleware: MiddlewareHandler<AppType>,
) {
  app.get("/evidence-ledger/:chittyId", authMiddleware, async (c) => {
    const chittyId = c.req.param("chittyId");
    if (!CHITTY_ID_PATTERN.test(chittyId)) {
      return c.json(
        { error: "invalid_chitty_id", message: "chittyId must match canonical format" },
        400,
      );
    }
    try {
      const evidence = await getEvidence(c.env, chittyId);
      return c.json(evidence);
    } catch (err) {
      if (err instanceof LedgerClientError) {
        // Surface 404 distinctly; everything else becomes 502 bad-gateway.
        if (err.status === 404) {
          return c.json(
            { error: "not_found", message: "Evidence not in ledger", chitty_id: chittyId },
            404,
          );
        }
        return c.json(
          {
            error: "ledger_unavailable",
            message: err.message,
            upstream_status: err.status,
          },
          502,
        );
      }
      throw err;
    }
  });

  // -----------------------------------------------------------------
  // POST /api/evidence-ledger/submit — Phase 3c
  // Mirrors Express server/routes.ts:51. Forwards body opaquely to the
  // ledger; submitterId is server-injected from claims.chitty_id.
  // -----------------------------------------------------------------
  app.post("/evidence-ledger/submit", authMiddleware, async (c) => {
    const claims = c.get("claims");
    let body: any;
    try {
      body = await c.req.json();
    } catch {
      return c.json(
        { error: "invalid_json", message: "Request body must be valid JSON" },
        400,
      );
    }
    const { evidenceType, data, metadata } = body ?? {};
    if (!evidenceType || typeof data === "undefined") {
      return c.json(
        {
          error: "invalid_input",
          message: "evidenceType and data are required",
        },
        400,
      );
    }
    try {
      const result = await submitEvidence(c.env, {
        evidenceType,
        data,
        metadata: { ...(metadata ?? {}), submissionSource: "ChittyAssets" },
        submitterId: claims.chitty_id,
      });
      return c.json({
        success: true,
        chittyId: result.chittyId,
        status: result.status,
        trustScore: result.trustScore,
        retentionUntil: result.retentionUntil,
        chainResult: result.chainResult,
      });
    } catch (err) {
      if (err instanceof LedgerClientError) {
        return c.json(
          {
            error: "ledger_unavailable",
            message: err.message,
            upstream_status: err.status,
          },
          502,
        );
      }
      throw err;
    }
  });

  // -----------------------------------------------------------------
  // POST /api/evidence-ledger/:chittyId/verify — Phase 3c
  // Mirrors Express server/routes.ts:92.
  // -----------------------------------------------------------------
  app.post("/evidence-ledger/:chittyId/verify", authMiddleware, async (c) => {
    const chittyId = c.req.param("chittyId");
    if (!CHITTY_ID_PATTERN.test(chittyId)) {
      return c.json(
        {
          error: "invalid_chitty_id",
          message: "chittyId must match canonical format",
        },
        400,
      );
    }
    try {
      const verification = await verifyEvidence(c.env, chittyId);
      return c.json(verification);
    } catch (err) {
      if (err instanceof LedgerClientError) {
        if (err.status === 404) {
          return c.json(
            {
              error: "not_found",
              message: "Evidence not in ledger",
              chitty_id: chittyId,
            },
            404,
          );
        }
        return c.json(
          {
            error: "ledger_unavailable",
            message: err.message,
            upstream_status: err.status,
          },
          502,
        );
      }
      throw err;
    }
  });
}

export const evidenceLedgerRoutes = (() => {
  const r = new Hono<AppType>();
  registerEvidenceLedgerRoutes(r, requireChittyAuth);
  return r;
})();
