// @canon: chittycanon://core/services/chittyassets
// Drizzle ORM factory for Cloudflare Workers + Hyperdrive.
//
// Per-request instantiation — do NOT cache at module scope. Hyperdrive pools
// connections externally; each Worker invocation gets a proxied connection string.
//
// Adapter: drizzle-orm/postgres-js (postgres.js) — Cloudflare-recommended for Hyperdrive.

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "@shared/schema";

export type ChittyAssetsDb = ReturnType<typeof getDb>;

/**
 * Create a Drizzle client for a single Worker invocation.
 * Pass `env.CHITTYASSETS_DB.connectionString` in production,
 * or a direct Neon connection string in integration tests.
 */
export function getDb(connectionString: string) {
  const sql = postgres(connectionString, {
    // max=1: Hyperdrive pools externally; one connection per isolate invocation.
    max: 1,
    idle_timeout: 20,
    ssl: "require",
    connection: { application_name: "chittyassets-worker" },
  });
  return drizzle(sql, { schema });
}
