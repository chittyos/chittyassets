---
uri: chittycanon://docs/gov/policy/security/chittyassets
namespace: chittycanon://docs/gov
type: policy
version: 1.0.0
status: ACTIVE
registered_with: chittycanon://core/services/canon
title: "ChittyAssets Security Policy"
certifier: chittycanon://core/services/cert
visibility: PUBLIC
---

# Security Policy — ChittyAssets

Service: `chittycanon://core/services/chittyassets`
Tier: 4 (Domain — asset ownership, evidence pipeline, blockchain integration)
Contact: security@chitty.cc

---

## Reporting a Vulnerability

**Do NOT open public GitHub issues for security bugs.**

### Preferred: GitHub Security Advisory

Open a private advisory at:
<https://github.com/CHITTYOS/chittyassets/security/advisories/new>

Include:
- Affected endpoint(s), route(s), or module(s)
- Step-by-step reproduction
- Impact assessment (data exposure, privilege escalation, evidence tampering, ACL bypass, etc.)
- Any suggested remediation or patch

### Alternative: Email

`security@chitty.cc` — PGP fingerprint available on request.

---

## Response SLA

| Stage | Target |
|---|---|
| Acknowledgement | 48 hours |
| Triage + severity classification | 5 business days |
| Fix — Critical severity | 14 days |
| Fix — High severity | 30 days |
| Fix — Medium / Low | Next scheduled release |
| Public disclosure | Coordinated with reporter; default 90 days post-fix |

Reporters are credited in release notes and security advisories unless anonymity is requested.

---

## Supported Versions

ChittyAssets deploys continuously to Cloudflare Workers. There are no long-term-support branches.

| Scope | Support window |
|---|---|
| Current deploy on `main` | Full support |
| Previous deploy on `main` | Patch support (critical only) |
| Any prior deploy | No support — upgrade required |

Validate findings against the current deploy at the production Worker URL. The `compatibility_date` in `wrangler.toml` must be current — stale compat dates are a known open issue (see CHARTER.md compliance flags).

---

## Severity Guidelines

ChittyOS-adapted CVSS interpretation for a Tier 4 service handling asset ownership proofs and legal evidence:

**Critical** — Unauthenticated access to evidence files or asset records; ACL bypass in GCS object streaming (`/objects/:objectPath`); JWT validation bypass in `requireChittyAuth()`; forged ChittyChain freeze or mint transactions; arbitrary code execution in the Worker or AI pipeline.

**High** — Authenticated privilege escalation (user A accessing user B's assets or evidence); trust score manipulation via GPT-4o prompt injection on evidence payloads; evidence tampering after blockchain freeze; exfiltration of the Neon DB connection string or GCS credentials.

**Medium** — Information disclosure of asset metadata to unauthorized users; denial of service against the evidence analysis pipeline; incorrect ACL policy applied to a GCS evidence file; timeline event forgery (non-cryptographic).

**Low** — Best-practice violations with no demonstrable exploit; issues confined to local development paths; rate-limiting gaps with no demonstrated abuse path.

---

## Threat Model Summary

ChittyAssets sits at the intersection of four sensitive surfaces. Researchers should focus here:

### 1. Evidence File ACL (Google Cloud Storage)

Evidence files are private by default. Access is gated by `ObjectPermission.READ` checks in `server/objectStorage.ts` before any GCS stream is returned via `/objects/:objectPath`.

**Risk**: An ACL policy misconfiguration or a bypassable ownership check would expose potentially legally privileged evidence files.

**Mitigations**: Per-object ACL enforcement; all GCS access goes through `objectStorage.ts`; signed upload URLs (`/api/objects/upload`) have short TTLs.

### 2. AI Analysis Pipeline (GPT-4o)

`server/aiAnalysis.ts` sends user-supplied evidence content to OpenAI GPT-4o for analysis (receipt parsing, valuation, legal document generation). The analysis results feed the `trustScore` recorded on-chain.

**Risk**: Prompt injection in evidence payloads could manipulate trust scores, generate fraudulent legal documents, or exfiltrate system prompt content.

**Mitigations**: Analysis types are enumerated (`receipt`, `document`, `asset_valuation`); results are stored as structured JSON, not executed; trust score calculation is a downstream computation, not a direct AI output.

### 3. Blockchain Integrity (ChittyChain Freeze / Mint)

`POST /api/assets/:id/freeze` and `POST /api/assets/:id/mint` trigger calls to `chain.chitty.cc`. The 7-day freeze period is enforced by ChittyChain, not by this service.

**Risk**: A race condition or replay attack on the freeze/mint endpoints could allow premature minting or double-minting. A forged response from `chain.chitty.cc` could record a false `blockchainHash`.

**Mitigations**: Ownership check enforced before each state transition; `chittyChainStatus` field transitions are validated (`draft → frozen → minted`); all transitions are written as immutable timeline events.

### 4. JWT Authentication (ChittyAuth)

All protected routes require a valid JWT issued by `auth.chitty.cc` and validated in `server/chittyAuth.ts` via `requireChittyAuth()`.

**Risk**: JWT validation bugs, algorithm confusion attacks, or token replay without expiry enforcement could grant unauthorized access.

**Mitigations**: Validation delegated to `auth.chitty.cc`; tokens carry user scope; middleware applied uniformly via route registration in `server/routes.ts`.

### 5. Evidence Ledger Submissions (ledger.chitty.cc)

`POST /api/evidence-ledger/submit` forwards evidence to `chittycanon://core/services/evidence`. This is a write path to the ChittyOS shared evidence ledger.

**Risk**: Submitting forged or tampered evidence records to the shared ledger could corrupt data consumed by downstream legal services.

**Mitigations**: Evidence ChittyID is validated before submission; integrity is ultimately the responsibility of `chittycanon://core/services/evidence` — see that service's security policy.

---

## Scope

### In Scope

- All API routes in `server/routes.ts` deployed to Cloudflare Workers
- `server/chittyAuth.ts` — JWT validation middleware
- `server/objectStorage.ts` — GCS ACL enforcement and signed URL generation
- `server/aiAnalysis.ts` — GPT-4o evidence analysis pipeline
- `server/chittyCore.ts` — ChittyOS upstream client (id/trust/chain/ledger calls)
- `server/storage.ts` — Neon DB query layer (SQL injection surface)
- `shared/schema.ts` — Zod validation schemas (input validation surface)
- CI/CD configurations under `.github/workflows/` that affect the Worker supply chain

### Out of Scope

- **Vendored dependencies** (`node_modules/`) — report upstream; we track and upgrade
- **Google Cloud Storage** itself — report to Google
- **OpenAI / GPT-4o** — report to OpenAI
- **Neon PostgreSQL** infrastructure — report to Neon
- **Cloudflare Workers runtime** — report to Cloudflare
- **ChittyAuth token issuance** — report to `chittycanon://core/services/auth`
- **ChittyChain blockchain** — report to `chittycanon://core/services/chain`
- Physical or social engineering attacks against ChittyOS personnel

---

## Safe Harbor

We will not pursue legal action against security researchers who:

1. Make a good-faith effort to avoid privacy violations, data destruction, and service interruption.
2. Do not exfiltrate data beyond what is minimally necessary to demonstrate impact.
3. Do not attempt to access, modify, or destroy asset or evidence data belonging to other users.
4. Give us reasonable time to respond before any public disclosure.
5. Do not use findings to benefit third parties or harm users.

Research that complies with this policy is considered authorized access under our terms of service. Evidence records touched during testing should be flagged to `security@chitty.cc` so they can be purged from the ledger.

---

## Known Open Security Issues

The following are disclosed and tracked — do not report these as new findings:

1. **Stale `wrangler.toml` compat date** (`2024-01-01`) — suppresses runtime flag updates. Tracked in CHARTER.md.
2. **Missing `[[tail_consumers]]`** — audit event streaming to ChittyChronicle is not yet wired at the infrastructure level. Tracked in CHARTER.md.
3. **Auth migration** — CLAUDE.md references legacy Replit Auth; production code uses ChittyAuth. Full Replit Auth removal is a tracked compliance item.

---

## Related Policies

- **Incident response**: coordinated with `chittyops.chitty.cc` on Critical/High confirmation
- **Certificate revocation**: handled by `chittycanon://core/services/cert` if a fix invalidates issued certificates
- **Ecosystem advisories**: published through `registry.chitty.cc` and relayed to registered consumers
- **Evidence retention**: 2555 days (7 years), per FRE and USA Federal jurisdiction — do not request deletion of evidence records under legal hold

---

*Last reviewed: 2026-05-10. This policy is a living document; breaking changes bump the `version` field in the front-matter.*
