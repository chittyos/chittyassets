// @canon: chittycanon://core/services/chittyassets
// ChittyMint HTTP client — freeze + mint operations on the ChittyChain.
// Workers-compatible (uses global fetch). 3s per-call timeout, no retries.
//
// Phase 3c: backs /api/assets/:id/freeze and /api/assets/:id/mint.
//
// Per chittycanon://gov/governance#core-types — the chittyId being frozen/
// minted references a Thing (T) asset. The caller is a Person (P). Mint
// produces an Event (E) recorded on the timeline. All five P/L/T/E/A
// enumerated in env.ts.
//
// KNOWN GAP (documented in PR body): Express called the legacy
// chittyCloudMcp at api.chittycloud.com with paths /v1/chain/freeze and
// /v1/chain/mint. The Worker `CHITTYMINT_URL` defaults to mint.chitty.cc;
// the path shape there has not been verified live. Real integration tests
// exercise the 502 mapping (host-unreachable / non-2xx) — real-success
// coverage requires the mint endpoint to be wired or a Cloudflare service
// binding to be added in Phase 4.

import type { Env } from "../env";

const DEFAULT_MINT_URL = "https://mint.chitty.cc";

export class MintClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly upstream: string,
  ) {
    super(message);
    this.name = "MintClientError";
  }
}

function baseUrl(env: Env): string {
  return env.CHITTYMINT_URL ?? DEFAULT_MINT_URL;
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
      throw new MintClientError(
        `ChittyMint returned ${res.status}`,
        res.status,
        url,
      );
    }
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof MintClientError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    throw new MintClientError(`mint fetch failed: ${msg}`, 502, url);
  } finally {
    clearTimeout(timer);
  }
}

export interface FreezeResponse {
  ipfsHash?: string;
  freezeTimestamp?: string;
  [k: string]: unknown;
}

export interface MintResponse {
  tokenId?: string;
  transactionHash?: string;
  [k: string]: unknown;
}

/**
 * Freeze a Thing-typed asset on the ChittyChain for the 7-day immutability
 * window. Mirrors server/chittyCloudMcp.ts:freezeAsset.
 */
export async function freezeAsset(
  env: Env,
  chittyId: string,
  assetData: unknown,
  opts: { timeoutMs?: number } = {},
): Promise<FreezeResponse> {
  const url = `${baseUrl(env)}/v1/chain/freeze`;
  return postJson<FreezeResponse>(
    url,
    {
      chittyId,
      assetData,
      freezeDuration: "7d",
      metadata: {
        source: "ChittyAssets",
        timestamp: new Date().toISOString(),
      },
    },
    opts.timeoutMs ?? 3000,
  );
}

/**
 * Mint an evidence token for a frozen asset. Mirrors
 * server/chittyCloudMcp.ts:mintAssetToken.
 */
export async function mintAssetToken(
  env: Env,
  chittyId: string,
  evidenceHash: string,
  opts: { timeoutMs?: number } = {},
): Promise<MintResponse> {
  const url = `${baseUrl(env)}/v1/chain/mint`;
  return postJson<MintResponse>(
    url,
    { chittyId, evidenceHash, mintingFee: "0.1" },
    opts.timeoutMs ?? 3000,
  );
}
