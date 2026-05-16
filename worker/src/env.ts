// @canon: chittycanon://core/services/chittyassets
// Typed bindings for the chittyassets Worker. Must match wrangler.jsonc exactly.

import { z } from "zod";

// Per chittycanon://gov/governance#core-types — all five must be enumerated, never omitted.
export const ENTITY_TYPES = ["P", "L", "T", "E", "A"] as const;
export type EntityType = typeof ENTITY_TYPES[number];

// ChittyID format: VV-G-LLL-SSSS-T-YM-C-X
export const CHITTY_ID_PATTERN = /^[A-Z0-9]{2}-[A-Z0-9]-[A-Z0-9]{3}-[A-Z0-9]{4}-[PLTEA]-[A-Z0-9]{2}-[A-Z0-9]-[A-Z0-9]$/;

export interface Env {
  ENVIRONMENT: "development" | "production";
  CHITTYAUTH_ISSUER: string;
  CHITTYAUTH_JWKS_URL: string;
  CHITTYAUTH_AUDIENCE: string;
  CHITTYMINT_URL?: string;
  CHITTYCONNECT_URL?: string;
  CHITTYLEDGER_URL?: string;

  // Phase 2+ bindings (active):
  CHITTYASSETS_DB: Hyperdrive;
  // EVIDENCE: R2Bucket;
  // PROCESSED: R2Bucket;
  // CHITTYCONNECT: Fetcher;
}

export const ChittyAuthClaimsSchema = z
  .object({
    iss: z.string().url(),
    sub: z.string().regex(CHITTY_ID_PATTERN),
    chitty_id: z.string().regex(CHITTY_ID_PATTERN),
    entity_type: z.enum(ENTITY_TYPES),
    trust_level: z.number().int().min(0).max(5),
    exp: z.number().int(),
    iat: z.number().int(),
    email: z.string().email().optional(),
    aud: z.union([z.string(), z.array(z.string())]).optional(),
  })
  .refine((c) => c.sub === c.chitty_id, { message: "sub must equal chitty_id" })
  .refine((c) => c.exp > c.iat, { message: "exp must be after iat" });

export type ChittyAuthClaims = z.infer<typeof ChittyAuthClaimsSchema>;
