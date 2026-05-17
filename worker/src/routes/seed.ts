// @canon: chittycanon://core/services/chittyassets
// Dev-only seed route — Phase 3c.
//
// Route ported:
//   POST /api/seed-demo   server/routes.ts:39
//
// Gate: returns 403 unless c.env.ENVIRONMENT === "development". Production
// deployment must reject this endpoint unconditionally — operational
// hygiene, not security-critical (still ownership-scoped to caller).
//
// Per chittycanon://gov/governance#core-types — seeded rows are Thing (T)
// assets owned by the calling Person (P). No Authority (A), Location (L),
// or Event (E) records are minted here beyond the implicit acquisition
// timeline event per asset. All five P/L/T/E/A enumerated in env.ts.

import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { assets, timelineEvents } from "@shared/schema";
import { requireChittyAuth } from "../auth";
import { getDb } from "../db";
import type { Env, ChittyAuthClaims } from "../env";

type Variables = { claims: ChittyAuthClaims };
type AppType = { Bindings: Env; Variables: Variables };

// Realistic ChittyOS-shaped demo rows. No "Lorem ipsum" / "Foo Bar" placeholders.
// chittyId left null — assets table treats chitty_id as nullable; minting
// happens via POST /api/assets/:id/mint per Phase 3a's documented deferral.
function buildDemoAssets(userId: string) {
  return [
    {
      userId,
      name: "MacBook Pro 16-inch M3 Max",
      description:
        "High-performance laptop for professional work with M3 Max chip",
      assetType: "electronics" as const,
      status: "active" as const,
      purchasePrice: "3499.00",
      currentValue: "2800.00",
      purchaseDate: new Date("2024-01-15"),
      location: "Home Office",
      serialNumber: "MBP2024001",
      model: "MacBook Pro 16-inch",
      manufacturer: "Apple",
      condition: "excellent",
      trustScore: "92.5",
      verificationStatus: "verified" as const,
      chittyChainStatus: "minted" as const,
      tags: ["work", "computer", "apple", "high-value"],
      metadata: {
        warranty: "AppleCare+ until 2027",
        specifications: {
          processor: "M3 Max",
          memory: "32GB",
          storage: "1TB SSD",
        },
      },
    },
    {
      userId,
      name: "2023 Tesla Model Y Long Range",
      description: "Electric SUV with Full Self-Driving capability",
      assetType: "vehicle" as const,
      status: "active" as const,
      purchasePrice: "68990.00",
      currentValue: "58500.00",
      purchaseDate: new Date("2023-06-20"),
      location: "Garage",
      serialNumber: "5YJYGDEE3NF123456",
      model: "Model Y",
      manufacturer: "Tesla",
      condition: "excellent",
      trustScore: "96.8",
      verificationStatus: "verified" as const,
      chittyChainStatus: "settled" as const,
      tags: ["vehicle", "electric", "tesla", "high-value"],
      metadata: {
        vin: "5YJYGDEE3NF123456",
        features: ["Full Self-Driving", "Premium Interior", "Tow Package"],
        color: "Pearl White Multi-Coat",
      },
    },
    {
      userId,
      name: "Home Office Property",
      description: "Commercial property used as home office and studio",
      assetType: "real_estate" as const,
      status: "active" as const,
      purchasePrice: "650000.00",
      currentValue: "825000.00",
      purchaseDate: new Date("2021-03-10"),
      location: "123 Innovation Drive, Tech City",
      serialNumber: "PROP-2021-001",
      model: "Commercial Office Space",
      manufacturer: "Custom Build",
      condition: "excellent",
      trustScore: "89.3",
      verificationStatus: "pending" as const,
      chittyChainStatus: "draft" as const,
      tags: ["real-estate", "commercial", "office", "investment"],
      metadata: {
        sqft: "2500",
        zoning: "Commercial",
        taxId: "123-456-789",
      },
    },
  ];
}

export function registerSeedRoutes(
  app: Hono<AppType>,
  authMiddleware: MiddlewareHandler<AppType>,
) {
  app.post("/seed-demo", authMiddleware, async (c) => {
    if (c.env.ENVIRONMENT !== "development") {
      return c.json(
        {
          error: "forbidden",
          message: "Seed endpoint disabled outside development",
        },
        403,
      );
    }
    const claims = c.get("claims");
    const userId = claims.chitty_id;
    const db = getDb(c.env.CHITTYASSETS_DB.connectionString);
    const demoAssets = buildDemoAssets(userId);

    const inserted = await db.transaction(async (tx) => {
      const rows = await tx.insert(assets).values(demoAssets).returning();
      // Emit one acquisition timeline event per asset, matching Express
      // semantics for asset creates.
      for (const r of rows) {
        await tx.insert(timelineEvents).values({
          assetId: r.id,
          userId,
          eventType: "acquisition",
          title: `Asset "${r.name}" added to portfolio`,
          description: "Seeded via /api/seed-demo (development only)",
          eventDate: new Date(),
        });
      }
      return rows;
    });

    return c.json(
      { message: `Created ${inserted.length} demo assets`, assetCount: inserted.length },
      201,
    );
  });
}

export const seedRoutes = (() => {
  const r = new Hono<AppType>();
  registerSeedRoutes(r, requireChittyAuth);
  return r;
})();
