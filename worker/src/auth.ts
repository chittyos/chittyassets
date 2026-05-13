// @canon: chittycanon://core/services/auth
// JWKS-based JWT verification for ChittyAuth-issued tokens.
// Per CHARTER §Security: middleware on all protected routes.

import { createRemoteJWKSet, errors as joseErrors, jwtVerify } from "jose";
import type { Context, MiddlewareHandler } from "hono";
import { ChittyAuthClaimsSchema, type ChittyAuthClaims, type Env } from "./env";

const JWKS_TIMEOUT_MS = 5000;
const JWKS_COOLDOWN_MS = 30000;

let cachedJWKS: ReturnType<typeof createRemoteJWKSet> | null = null;
let cachedJWKSUrl: string | null = null;

function getJWKS(jwksUrl: string) {
  if (!cachedJWKS || cachedJWKSUrl !== jwksUrl) {
    cachedJWKS = createRemoteJWKSet(new URL(jwksUrl), {
      timeoutDuration: JWKS_TIMEOUT_MS,
      cooldownDuration: JWKS_COOLDOWN_MS,
    });
    cachedJWKSUrl = jwksUrl;
  }
  return cachedJWKS;
}

function extractBearer(c: Context): string | null {
  const header = c.req.header("authorization") || c.req.header("Authorization");
  if (header?.startsWith("Bearer ")) return header.slice(7);
  // JWTs are base64url — never URL-encoded. No decode needed.
  const cookie = c.req.header("cookie");
  if (cookie) {
    const m = cookie.match(/(?:^|;\s*)chitty_jwt=([^;\s]+)/);
    if (m) return m[1];
  }
  return null;
}

function logReject(c: Context, reason: string, detail?: string) {
  // Tail consumer (chittytrack) captures these; no PII beyond reason code.
  console.error("auth_reject", {
    reason,
    detail,
    path: c.req.path,
    method: c.req.method,
    ip: c.req.header("cf-connecting-ip") ?? null,
  });
}

export const requireChittyAuth: MiddlewareHandler<{ Bindings: Env; Variables: { claims: ChittyAuthClaims } }> =
  async (c, next) => {
    const token = extractBearer(c);
    if (!token) {
      logReject(c, "missing_token");
      return c.json({ error: "unauthenticated" }, 401);
    }

    let payload: unknown;
    try {
      const verified = await jwtVerify(token, getJWKS(c.env.CHITTYAUTH_JWKS_URL), {
        issuer: c.env.CHITTYAUTH_ISSUER,
        audience: c.env.CHITTYAUTH_AUDIENCE,
      });
      payload = verified.payload;
    } catch (err) {
      // Distinguish infra (fail closed but signal ops) from validation (client problem).
      if (err instanceof joseErrors.JWKSNoMatchingKey || err instanceof joseErrors.JWKSMultipleMatchingKeys) {
        logReject(c, "jwks_key_mismatch", (err as Error).name);
        return c.json({ error: "unauthenticated" }, 401);
      }
      if (err instanceof joseErrors.JWTExpired) {
        logReject(c, "token_expired");
        return c.json({ error: "token_expired" }, 401);
      }
      if (err instanceof joseErrors.JWTClaimValidationFailed || err instanceof joseErrors.JWTInvalid) {
        logReject(c, "token_invalid", (err as Error).name);
        return c.json({ error: "unauthenticated" }, 401);
      }
      // Anything else is likely infra (JWKS unreachable, timeout). Log loudly, surface generic 503.
      console.error("auth_jwks_unavailable", {
        path: c.req.path,
        error: (err as Error).name,
        message: (err as Error).message,
      });
      return c.json({ error: "auth_service_unavailable" }, 503);
    }

    const parsed = ChittyAuthClaimsSchema.safeParse(payload);
    if (!parsed.success) {
      logReject(c, "claims_schema", parsed.error.issues[0]?.code);
      return c.json({ error: "unauthenticated" }, 401);
    }

    // Per chittycanon://gov/governance — authenticated principals are Person (P), never Thing.
    if (parsed.data.entity_type !== "P") {
      logReject(c, "principal_not_person", parsed.data.entity_type);
      return c.json({ error: "forbidden" }, 403);
    }

    c.set("claims", parsed.data);
    return await next();
  };
