// @canon: chittycanon://core/services/chittyassets
// ChittyLedger HTTP client — Workers-compatible (uses global fetch).
//
// Per chittycanon://gov/governance#core-types the chittyId being looked up can
// reference any of the five entity types P/L/T/E/A — the ledger does not
// restrict by type; this client is type-agnostic and forwards opaquely.
//
// Phase 2c: backs GET /api/evidence-ledger/:chittyId. Real HTTP only — no mocks.
// Phase 3c: extends with submitEvidence() + verifyEvidence() for the two write
// surfaces (POST /api/evidence-ledger/submit, POST /api/evidence-ledger/:chittyId/verify).

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

// ----------------------------------------------------------------------
// Phase 3c write helpers — submit + verify. Both are real HTTP, 3s timeout.
// Per chittycanon://gov/governance#core-types the submitted evidence is a
// Thing (T); the submitter is a Person (P); the resulting ledger record is
// an Event (E). Authority (A) and Location (L) are not exercised here. All
// five P/L/T/E/A remain enumerated in env.ts.
// ----------------------------------------------------------------------

export interface LedgerSubmitRequest {
  evidenceType: string;
  data: unknown;
  metadata?: Record<string, unknown>;
  submitterId: string;
}

export interface LedgerSubmitResponse {
  chittyId?: string;
  status?: string;
  trustScore?: number;
  retentionUntil?: string;
  chainResult?: unknown;
  [k: string]: unknown;
}

export interface LedgerVerifyResponse {
  verified?: boolean;
  trustScore?: number;
  [k: string]: unknown;
}

async function postJson<T>(
  url: string,
  body: unknown,
  timeoutMs: number,
): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new Error("timeout")), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      throw new LedgerClientError(
        `ChittyLedger returned ${res.status}`,
        res.status,
        url,
      );
    }
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof LedgerClientError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    throw new LedgerClientError(`ledger fetch failed: ${msg}`, 502, url);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Submit evidence to ChittyLedger. Real network call, 3s timeout.
 * Mirrors server/chittyCore.ts:evidenceLedger.submitEvidence — wire shape
 * forwarded opaquely; the ledger owns its schema.
 */
export async function submitEvidence(
  env: Env,
  body: LedgerSubmitRequest,
  opts: { timeoutMs?: number } = {},
): Promise<LedgerSubmitResponse> {
  const url = `${baseUrl(env)}/api/v1/evidence`;
  return postJson<LedgerSubmitResponse>(url, body, opts.timeoutMs ?? 3000);
}

/**
 * Trigger ledger-side verification for a previously submitted chittyId.
 * Mirrors server/chittyCore.ts:evidenceLedger.verifyEvidence.
 */
export async function verifyEvidence(
  env: Env,
  chittyId: string,
  opts: { timeoutMs?: number } = {},
): Promise<LedgerVerifyResponse> {
  const url = `${baseUrl(env)}/api/v1/evidence/${encodeURIComponent(chittyId)}/verify`;
  return postJson<LedgerVerifyResponse>(url, {}, opts.timeoutMs ?? 3000);
}
