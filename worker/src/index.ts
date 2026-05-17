// @canon: chittycanon://core/services/chittyassets
// chittyassets Worker entrypoint (Hono). Tier 4 Domain service.
// Phase 2a: asset read routes ported (GET /api/assets, /api/assets/stats,
//           /api/assets/:id, /api/assets/:assetId/evidence,
//           /api/assets/:assetId/timeline).
// Phase 2b: simple owner-scoped reads ported
//   (GET /api/assets/:assetId/warranties, /api/warranties/expiring,
//    /api/assets/:assetId/insurance, /api/legal-cases, /api/tools/resources).
// Phase 2c: external HTTP reads ported
//   (GET /api/evidence-ledger/:chittyId, GET /api/ecosystem/status).
// Phase 3a: asset write routes ported (POST/PUT/DELETE /api/assets[/:id])
//           and evidence attach (POST /api/assets/:assetId/evidence).
// Phase 3b: domain write routes ported
//   (POST /api/assets/:assetId/warranties,
//    POST /api/assets/:assetId/insurance,
//    POST /api/legal-cases).

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { ENTITY_TYPES, type ChittyAuthClaims, type Env } from "./env";
import { requireChittyAuth } from "./auth";
import { assetRoutes } from "./routes/assets";
import { warrantyRoutes } from "./routes/warranties";
import { insuranceRoutes } from "./routes/insurance";
import { legalCaseRoutes } from "./routes/legal-cases";
import { toolRoutes } from "./routes/tools";
import { evidenceLedgerRoutes } from "./routes/evidence-ledger";
import { ecosystemRoutes } from "./routes/ecosystem";
import { evidenceRoutes } from "./routes/evidence";

type Variables = { claims: ChittyAuthClaims };

const ALLOWED_ORIGINS = new Set([
  "https://assets.chitty.cc",
  "https://chitty.cc",
  "https://www.chitty.cc",
  "http://localhost:5173",
  "http://localhost:5000",
]);

function corsOrigin(origin: string | undefined): string | null {
  if (!origin) return null;
  return ALLOWED_ORIGINS.has(origin) ? origin : null;
}

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.use("*", logger());
app.use("*", cors({
  origin: corsOrigin,
  credentials: true,
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
}));

app.get("/health", (c) =>
  c.json({
    status: "ok",
    service: "chittyassets",
    tier: 4,
    canonical_uri: "chittycanon://core/services/chittyassets",
    version: "1.0.0",
    environment: c.env.ENVIRONMENT,
    timestamp: new Date().toISOString(),
  }),
);

app.get("/api/v1/status", (c) =>
  c.json({
    status: "ok",
    service: "chittyassets",
    tier: 4,
    canonical_uri: "chittycanon://core/services/chittyassets",
    version: "1.0.0",
    environment: c.env.ENVIRONMENT,
    migration_status: "PHASE_3B_DOMAIN_WRITES",
    migrated_routes: [
      "GET /api/assets",
      "GET /api/assets/stats",
      "GET /api/assets/:id",
      "GET /api/assets/:assetId/evidence",
      "GET /api/assets/:assetId/timeline",
      "GET /api/assets/:assetId/warranties",
      "GET /api/warranties/expiring",
      "GET /api/assets/:assetId/insurance",
      "GET /api/legal-cases",
      "GET /api/tools/resources",
      "GET /api/evidence-ledger/:chittyId",
      "GET /api/ecosystem/status",
      "POST /api/assets",
      "PUT /api/assets/:id",
      "DELETE /api/assets/:id",
      "POST /api/assets/:assetId/evidence",
      "POST /api/assets/:assetId/warranties",
      "POST /api/assets/:assetId/insurance",
      "POST /api/legal-cases",
    ],
    entity_types_handled: [...ENTITY_TYPES],
    dependencies: {
      chittyauth: c.env.CHITTYAUTH_ISSUER,
      chittymint: c.env.CHITTYMINT_URL ?? null,
      chittyconnect: c.env.CHITTYCONNECT_URL ?? null,
      chittyledger: c.env.CHITTYLEDGER_URL ?? null,
    },
    timestamp: new Date().toISOString(),
  }),
);

app.get("/api/auth/user", requireChittyAuth, (c) => {
  const claims = c.get("claims");
  return c.json({
    chitty_id: claims.chitty_id,
    entity_type: claims.entity_type,
    trust_level: claims.trust_level,
    email: claims.email ?? null,
  });
});

// Phase 2a/2b/2c read routes — registered BEFORE the 501 catch-all.
app.route("/api", assetRoutes);
app.route("/api", warrantyRoutes);
app.route("/api", insuranceRoutes);
app.route("/api", legalCaseRoutes);
app.route("/api", toolRoutes);
app.route("/api", evidenceLedgerRoutes);
app.route("/api", ecosystemRoutes);
app.route("/api", evidenceRoutes);

// Unmigrated routes return 501 unconditionally — no auth oracle.
app.all("/api/*", (c) =>
  c.json(
    {
      error: "not_yet_migrated",
      message: "Route not yet migrated from Express to Hono. See CHARTER.md §Compliance Flags.",
      path: c.req.path,
    },
    501,
  ),
);

app.notFound((c) => c.json({ error: "not_found", path: c.req.path }, 404));

app.onError((err, c) => {
  const correlationId = crypto.randomUUID();
  // Full error to tail consumer; generic message to client.
  console.error("worker_error", {
    correlation_id: correlationId,
    name: err.name,
    message: err.message,
    stack: err.stack,
    path: c.req.path,
    method: c.req.method,
  });
  return c.json({ error: "internal_error", correlation_id: correlationId }, 500);
});

export default app;
