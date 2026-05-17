// @canon: chittycanon://core/services/chittyassets
// Tool-resource read route — Phase 2b of Express→Hono migration.
//
// Route ported (GET only, static — no DB):
//   GET /api/tools/resources   server/routes.ts:117
//
// Per chittycanon://gov/governance#core-types — tool resources are Thing (T)
// artifacts: external capabilities surfaced to the agent layer. The caller
// is a Person (P). All five entity types P/L/T/E/A remain enumerated in env.ts.
//
// The resource catalog is inlined here (mirrors server/toolRegistry.ts) because
// the worker bundle cannot import Express-side modules. Keep these two lists
// in lockstep; a schema-overlord audit will compare them at PR time.

import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { requireChittyAuth } from "../auth";
import type { Env, ChittyAuthClaims } from "../env";

type Variables = { claims: ChittyAuthClaims };
type AppType = { Bindings: Env; Variables: Variables };

export type ToolCategory =
  | "cloudflare"
  | "content"
  | "communications"
  | "database";

export interface ToolResource {
  id: string;
  name: string;
  provider: string;
  description: string;
  category: ToolCategory;
  callable: boolean;
  capabilities: string[];
}

// Mirrors server/toolRegistry.ts exactly — keep in lockstep.
const TOOL_RESOURCES: ToolResource[] = [
  {
    id: "cloudflare.workers.assets",
    name: "Cloudflare Workers Evidence Tools",
    provider: "Cloudflare",
    description:
      "Edge Workers used by the Evidence Ledger for freeze/mint workflows.",
    category: "cloudflare",
    callable: true,
    capabilities: ["freeze", "mint", "status"],
  },
  {
    id: "notion.search",
    name: "Notion Workspace Search",
    provider: "Notion",
    description:
      "Search across workspace pages, databases, and synced asset briefs.",
    category: "content",
    callable: true,
    capabilities: ["search", "filter", "page-context"],
  },
  {
    id: "google.drive.search",
    name: "Google Drive Discovery",
    provider: "Google Drive",
    description:
      "Search Drive documents, spreadsheets, and evidence attachments.",
    category: "content",
    callable: true,
    capabilities: ["search", "metadata", "shared-drives"],
  },
  {
    id: "outlook.mail.search",
    name: "Outlook / SharePoint Email + Files",
    provider: "Microsoft 365",
    description:
      "Search Outlook mailboxes and SharePoint file evidence for discovery.",
    category: "communications",
    callable: true,
    capabilities: ["search", "attachments", "sharepoint-sites"],
  },
  {
    id: "neon.metadata.search",
    name: "Neon DB Metadata",
    provider: "Neon",
    description:
      "Search database schemas and column lineage for stored evidence.",
    category: "database",
    callable: true,
    capabilities: ["tables", "columns", "lineage"],
  },
];

export function registerToolRoutes(
  app: Hono<AppType>,
  authMiddleware: MiddlewareHandler<AppType>,
) {
  app.get("/tools/resources", authMiddleware, (c) => {
    return c.json({
      resources: TOOL_RESOURCES,
      callableResources: TOOL_RESOURCES.filter((r) => r.callable).map(
        (r) => r.id,
      ),
    });
  });
}

export const toolRoutes = (() => {
  const r = new Hono<AppType>();
  registerToolRoutes(r, requireChittyAuth);
  return r;
})();
