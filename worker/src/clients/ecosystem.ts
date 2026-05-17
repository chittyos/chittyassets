// @canon: chittycanon://core/services/chittyassets
// ChittyChain ecosystem fan-out client — Workers-compatible (global fetch).
//
// Phase 2c: backs GET /api/ecosystem/status. Fans out in parallel to the 5
// ChittyChain services (ChittyID, ChittyAssets, ChittyTrust, ChittyResolution,
// ChittyFile), each with a 3s timeout, aggregate 5s deadline.
//
// Per chittycanon://gov/governance#core-types the services themselves are
// Authority (A) bearers (they issue/verify credentials, decisions, attestations
// over Things, Events, Persons, and Locations). The full P/L/T/E/A enumeration
// lives in env.ts. Status here describes Authority availability — it is NOT a
// claim about any P/L/T/E entity.

import type { Env } from "../env";

export type ServiceKey =
  | "chittyid"
  | "chittyassets"
  | "chittytrust"
  | "chittyresolution"
  | "chittyfile";

export interface ServiceStatus {
  service: ServiceKey;
  url: string;
  reachable: boolean;
  http_status: number | null;
  latency_ms: number | null;
  health: Record<string, unknown> | null;
  error: string | null;
}

export interface EcosystemStatus {
  ok: boolean;
  checked_at: string;
  services: ServiceStatus[];
  summary: {
    total: number;
    reachable: number;
    unreachable: number;
  };
}

const DEFAULTS: Record<ServiceKey, string> = {
  chittyid: "https://id.chitty.cc",
  chittyassets: "https://assets.chitty.cc",
  chittytrust: "https://trust.chitty.cc",
  chittyresolution: "https://resolution.chitty.cc",
  chittyfile: "https://file.chitty.cc",
};

function resolveUrls(env: Env): Record<ServiceKey, string> {
  return {
    chittyid: env.CHITTYID_URL ?? DEFAULTS.chittyid,
    chittyassets: env.CHITTYASSETS_URL ?? DEFAULTS.chittyassets,
    chittytrust: env.CHITTYTRUST_URL ?? DEFAULTS.chittytrust,
    chittyresolution: env.CHITTYRESOLUTION_URL ?? DEFAULTS.chittyresolution,
    chittyfile: env.CHITTYFILE_URL ?? DEFAULTS.chittyfile,
  };
}

async function checkOne(
  service: ServiceKey,
  base: string,
  parentSignal: AbortSignal,
  perCallTimeoutMs: number,
): Promise<ServiceStatus> {
  const url = `${base.replace(/\/$/, "")}/health`;
  const ctrl = new AbortController();
  const timer = setTimeout(
    () => ctrl.abort(new Error("per-call timeout")),
    perCallTimeoutMs,
  );
  if (parentSignal.aborted) ctrl.abort(parentSignal.reason);
  else parentSignal.addEventListener("abort", () => ctrl.abort(parentSignal.reason));

  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: ctrl.signal,
    });
    const latency = Date.now() - start;
    let health: Record<string, unknown> | null = null;
    try {
      health = (await res.json()) as Record<string, unknown>;
    } catch {
      health = null;
    }
    return {
      service,
      url,
      reachable: res.ok,
      http_status: res.status,
      latency_ms: latency,
      health,
      error: res.ok ? null : `non-2xx: ${res.status}`,
    };
  } catch (err) {
    const latency = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);
    return {
      service,
      url,
      reachable: false,
      http_status: null,
      latency_ms: latency,
      health: null,
      error: msg,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fan out parallel health checks to the 5 ChittyChain ecosystem services.
 * Per-call timeout: 3s. Aggregate deadline: 5s. Never throws — degraded
 * services are reported individually with error context.
 */
export async function getEcosystemStatus(
  env: Env,
  opts: { perCallTimeoutMs?: number; aggregateTimeoutMs?: number } = {},
): Promise<EcosystemStatus> {
  const perCall = opts.perCallTimeoutMs ?? 3000;
  const aggregate = opts.aggregateTimeoutMs ?? 5000;
  const urls = resolveUrls(env);
  const parent = new AbortController();
  const aggTimer = setTimeout(
    () => parent.abort(new Error("aggregate timeout")),
    aggregate,
  );
  try {
    const keys = Object.keys(urls) as ServiceKey[];
    const results = await Promise.all(
      keys.map((k) => checkOne(k, urls[k], parent.signal, perCall)),
    );
    const reachable = results.filter((r) => r.reachable).length;
    return {
      ok: reachable === results.length,
      checked_at: new Date().toISOString(),
      services: results,
      summary: {
        total: results.length,
        reachable,
        unreachable: results.length - reachable,
      },
    };
  } finally {
    clearTimeout(aggTimer);
  }
}
