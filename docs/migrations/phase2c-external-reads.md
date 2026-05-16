---
uri: chittycanon://docs/tech/spec/chittyassets-phase2c
namespace: chittycanon://docs/tech
type: spec
version: 1.0.0
status: DRAFT
title: ChittyAssets Phase 2c — External Reads
visibility: INTERNAL
tags: [migration, hono, phase-2c, external-services]
@canon: chittycanon://core/services/chittyassets
---

# Phase 2c — External Reads (ChittyLedger, ecosystem status)

## Scope

| Method | Path | Source | External dep |
|--------|------|--------|--------------|
| GET | `/api/evidence-ledger/:chittyId` | `server/routes.ts:80` | ChittyLedger (`chittycanon://core/services/chittyledger`) |
| GET | `/api/ecosystem/status` | `server/routes.ts:105` | All Tier 0–4 service `/health` endpoints |

These wrap remote HTTP calls. The Express implementation uses
`server/chittyCloudMcp.ts` helpers (`getEvidenceLedger()`,
`getChittyServices()`); under Hono we replace MCP-style indirection with thin
typed HTTP clients.

## File layout

```
worker/src/
  clients/
    chittyledger.ts    # HTTP client for ledger.chitty.cc
    ecosystem.ts       # parallel /health probes
  routes/
    evidence-ledger.ts # GET /api/evidence-ledger/:chittyId
    ecosystem.ts       # GET /api/ecosystem/status
```

## Client contracts

### `clients/chittyledger.ts`

```ts
import { z } from 'zod';

const EvidenceRecordSchema = z.object({
  chittyId: z.string().regex(/^[0-9A-Z]{2}-[0-9]-[A-Z]{3}-[0-9]{4}-[PLTEA]-[0-9A-Z]{2}-[0-9]-[0-9A-Z]$/),
  status: z.enum(['draft', 'verified', 'sealed', 'disputed']),
  trustScore: z.number().min(0).max(1),
  retentionUntil: z.string().datetime(),
  chainResult: z.object({ ipfsHash: z.string(), txHash: z.string().optional() }).nullable(),
});

export class ChittyLedgerClient {
  constructor(private baseUrl: string, private bearerToken: string) {}

  async getEvidence(chittyId: string, signal?: AbortSignal) {
    const res = await fetch(`${this.baseUrl}/api/v1/evidence/${encodeURIComponent(chittyId)}`, {
      headers: { authorization: `Bearer ${this.bearerToken}` },
      signal,
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new LedgerError(res.status, await res.text());
    return EvidenceRecordSchema.parse(await res.json());
  }
}
```

### `clients/ecosystem.ts`

Probes all configured service base URLs in parallel with a 2s per-probe timeout
via `AbortSignal.timeout(2000)`. Returns
`{ services: Array<{ name, url, status: 'ok'|'degraded'|'down', latencyMs }> }`.

Service URL list is read from environment, not hardcoded. Suggested env vars
(Worker `[vars]`):

```jsonc
"CHITTY_LEDGER_URL": "https://ledger.chitty.cc",
"CHITTY_ID_URL":     "https://id.chitty.cc",
"CHITTY_TRUST_URL":  "https://trust.chitty.cc",
"CHITTY_AUTH_URL":   "https://auth.chitty.cc",
"CHITTY_MINT_URL":   "https://mint.chitty.cc",
```

The bearer token used for upstream ledger calls is the same ChittyAuth JWT
presented by the caller (token forwarding), not a service-to-service secret.
This preserves the authorization subject end-to-end.

## Retry / timeout policy

- **Per-call timeout**: 5s for `getEvidence`, 2s for each `/health` probe
- **Retries**: 2 retries on 5xx or network error, exponential backoff
  100ms → 300ms; no retry on 4xx
- **Circuit breaker**: out of scope for Phase 2c; tracked in
  `chittyobservability` integration (deferred)
- **Failure mode**: ledger 5xx after retries → return 503 with
  `{ error: 'upstream_unavailable', service: 'chittyledger', correlationId }`;
  ecosystem probe failure does NOT fail the whole status response — per-service
  `status: 'down'` with `error` field

## Validation gates

1. Type-check clean.
2. Real upstream integration test against staging ledger
   (`https://ledger-staging.chitty.cc`):
   - Submit a known ChittyID, then `GET /api/evidence-ledger/:chittyId` through
     the Worker, assert round-trip
3. Failure-injection test: point `CHITTY_LEDGER_URL` at a `127.0.0.1:1` URL,
   assert 503 + correlation ID, not a 500 with stack trace.
4. `curl https://assets.chitty.cc/api/ecosystem/status` returns 200 with
   per-service health.

## Estimated PR size

~500 LOC (clients, routes, tests, env wiring). External-service integration
tests are the long pole; budget time for staging-env coordination with the
ChittyLedger team.
