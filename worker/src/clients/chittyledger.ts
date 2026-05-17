// @canon: chittycanon://core/services/chittyassets
// ChittyLedger HTTP client — Workers-compatible (uses global fetch).
//
// Per chittycanon://gov/governance#core-types the chittyId being looked up can
// reference any of the five entity types P/L/T/E/A — the ledger does not
// restrict by type; this client is type-agnostic and forwards opaquely.
//
// Phase 2c: backs GET /api/evidence-ledger/:chittyId. Real HTTP only — no mocks.

import type { Env } from "../env";

const DEFAULT_LEDGER_URL = "https://ledger.chitty.cc";

export interface LedgerEvidenceResponse {
  // Opaque pass-through — ledger owns the schema. We surface JSON as-is so the
  // schema-overlord can audit ledger schema separately.
  [key: string]: unknown;
}

export class LedgerClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly upstream: string,
  ) {
    super(message);
    this.name = "LedgerClientError";
  }
}

function baseUrl(env: Env): string {
  return env.CHITTYLEDGER_URL ?? DEFAULT_LEDGER_URL;
}

/**
 * Fetch evidence by ChittyID from ChittyLedger.
 * Real network call. 3s per-request timeout via AbortController.
 * Throws LedgerClientError on non-2xx / timeout / network failure.
 */
export async function getEvidence(
  env: Env,
  chittyId: string,
  opts: { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<LedgerEvidenceResponse> {
  const url = `${baseUrl(env)}/api/v1/evidence/${encodeURIComponent(chittyId)}`;
  const timeoutMs = opts.timeoutMs ?? 3000;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new Error("timeout")), timeoutMs);
  // Chain caller-supplied signal if present.
  if (opts.signal) {
    if (opts.signal.aborted) ctrl.abort(opts.signal.reason);
    else opts.signal.addEventListener("abort", () => ctrl.abort(opts.signal!.reason));
  }
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: ctrl.signal,
    });
    if (!res.ok) {
      throw new LedgerClientError(
        `ChittyLedger returned ${res.status}`,
        res.status,
        url,
      );
    }
    const body = (await res.json()) as LedgerEvidenceResponse;
    return body;
  } catch (err) {
    if (err instanceof LedgerClientError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    throw new LedgerClientError(`ledger fetch failed: ${msg}`, 502, url);
  } finally {
    clearTimeout(timer);
  }
}
