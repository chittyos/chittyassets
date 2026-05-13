-- Migration 0001 — Initial canonical schema for ChittyAssets
-- Target: Neon project steep-cloud-28172078 (greenfield)
-- Canon: chittycanon://gov/governance#core-types (P/L/T/E/A)
--
-- Entity-type assignments (annotated on app-layer entities table in 0002):
--   users               -> P (Person): natural actor with agency
--   assets              -> T (Thing): object without agency, asset/artifact
--   evidence            -> T (Thing): document/artifact attached to an asset
--   timeline_events     -> E (Event): occurrence in time
--   warranties          -> T (Thing): contract-as-artifact
--   insurance_policies  -> T (Thing): policy-document-as-artifact
--   legal_cases         -> E (Event): proceeding with docket/status progression
--   ai_analysis_results -> E (Event): analysis run in time
--
-- All ChittyID-bearing rows use chitty_id varchar in canonical format
-- VV-G-LLL-SSSS-T-YM-C-X. Phase 3 (see docs/migrations/phase3-users-chittyid-migration.md)
-- migrates users.id from uuid to chitty_id; this migration keeps uuid PKs for
-- per-service tables so a backward-compatible deploy is possible.

BEGIN;

-- =====================================================================
-- Sessions (Replit Auth legacy; retained until ChittyAuth-only cutover)
-- =====================================================================
CREATE TABLE IF NOT EXISTS sessions (
  sid     varchar PRIMARY KEY,
  sess    jsonb   NOT NULL,
  expire  timestamp NOT NULL
);
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON sessions (expire);
COMMENT ON TABLE sessions IS 'Express session store. Legacy; removed after ChittyAuth-only cutover.';

-- =====================================================================
-- Users — Person (P)
-- =====================================================================
CREATE TABLE IF NOT EXISTS users (
  id                varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  chitty_id         varchar UNIQUE,            -- canonical Person ChittyID, populated by ChittyAuth
  email             varchar UNIQUE,
  first_name        varchar,
  last_name         varchar,
  profile_image_url varchar,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz
);
COMMENT ON TABLE users IS 'Person (P) — natural actor with agency. Canon: chittycanon://gov/governance#core-types';
COMMENT ON COLUMN users.chitty_id IS 'Canonical ChittyID (Person, T=P). Format VV-G-LLL-SSSS-P-YM-C-X. Phase 3 promotes this to PK.';
COMMENT ON COLUMN users.deleted_at IS 'GDPR soft-delete; audit trail preserved in ChittyLedger.';

-- =====================================================================
-- Enums
-- =====================================================================
CREATE TYPE asset_type AS ENUM (
  'real_estate','vehicle','artwork','jewelry','electronics',
  'documents','business_assets','intellectual_property','other'
);
CREATE TYPE asset_status AS ENUM (
  'active','disposed','lost','stolen','in_dispute','under_review'
);
CREATE TYPE verification_status AS ENUM (
  'pending','verified','rejected','expired'
);
CREATE TYPE chitty_chain_status AS ENUM (
  'draft','frozen','minted','settled','disputed'
);
CREATE TYPE evidence_type AS ENUM (
  'receipt','contract','photo','video','insurance_document',
  'warranty','maintenance_record','legal_filing','correspondence','other'
);
CREATE TYPE timeline_event_type AS ENUM (
  'acquisition','modification','maintenance','insurance_update',
  'valuation_change','location_change','status_change','evidence_added','other'
);
CREATE TYPE legal_case_status AS ENUM (
  'active','settled','dismissed','pending','on_appeal'
);

-- =====================================================================
-- Assets — Thing (T)
-- =====================================================================
CREATE TABLE IF NOT EXISTS assets (
  id                    varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  chitty_id             varchar UNIQUE,        -- canonical Thing ChittyID
  chitty_id_v2          varchar UNIQUE,        -- future Mod-97 Base32
  user_id               varchar NOT NULL REFERENCES users(id),
  name                  text NOT NULL,
  description           text,
  asset_type            asset_type NOT NULL,
  status                asset_status DEFAULT 'active',
  purchase_price        numeric(12,2),
  current_value         numeric(12,2),
  purchase_date         timestamptz,
  location              text,
  serial_number         varchar,
  model                 varchar,
  manufacturer          varchar,
  condition             varchar,
  trust_score           numeric(3,1) DEFAULT 0.0,
  blockchain_hash       varchar,
  block_number          varchar,
  ipfs_hash             varchar,
  freeze_timestamp      timestamptz,
  settlement_timestamp  timestamptz,
  minting_fee           numeric(8,6),
  verification_status   verification_status DEFAULT 'pending',
  chitty_chain_status   chitty_chain_status DEFAULT 'draft',
  tags                  text[],
  metadata              jsonb,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  deleted_at            timestamptz
);
CREATE INDEX IF NOT EXISTS idx_assets_user_id ON assets (user_id);
CREATE INDEX IF NOT EXISTS idx_assets_chitty_id ON assets (chitty_id);
CREATE INDEX IF NOT EXISTS idx_assets_metadata_gin ON assets USING GIN (metadata);
COMMENT ON TABLE assets IS 'Thing (T) — object without agency. The central artifact of ChittyAssets. Canon: chittycanon://gov/governance#core-types';
COMMENT ON COLUMN assets.chitty_id IS 'Canonical ChittyID (Thing, T=T). Format VV-G-LLL-SSSS-T-YM-C-X.';

-- =====================================================================
-- Evidence — Thing (T)
-- =====================================================================
CREATE TABLE IF NOT EXISTS evidence (
  id                  varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  chitty_id           varchar UNIQUE,
  asset_id            varchar NOT NULL REFERENCES assets(id),
  user_id             varchar NOT NULL REFERENCES users(id),
  name                text NOT NULL,
  evidence_type       evidence_type NOT NULL,
  file_path           text,
  file_size           integer,
  mime_type           varchar,
  extracted_data      jsonb,
  ai_analysis         jsonb,
  blockchain_hash     varchar,
  verification_status verification_status DEFAULT 'pending',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz
);
CREATE INDEX IF NOT EXISTS idx_evidence_asset_id ON evidence (asset_id);
CREATE INDEX IF NOT EXISTS idx_evidence_user_id ON evidence (user_id);
CREATE INDEX IF NOT EXISTS idx_evidence_extracted_data_gin ON evidence USING GIN (extracted_data);
COMMENT ON TABLE evidence IS 'Thing (T) — document/artifact attached to an asset. Canon: chittycanon://gov/governance#core-types';

-- =====================================================================
-- Timeline events — Event (E)
-- =====================================================================
CREATE TABLE IF NOT EXISTS timeline_events (
  id                   varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  chitty_id            varchar UNIQUE,
  asset_id             varchar NOT NULL REFERENCES assets(id),
  user_id              varchar NOT NULL REFERENCES users(id),
  event_type           timeline_event_type NOT NULL,
  title                text NOT NULL,
  description          text,
  event_date           timestamptz NOT NULL,
  related_evidence_id  varchar REFERENCES evidence(id),
  metadata             jsonb,
  created_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_timeline_events_asset_id ON timeline_events (asset_id);
CREATE INDEX IF NOT EXISTS idx_timeline_events_event_date ON timeline_events (event_date);
COMMENT ON TABLE timeline_events IS 'Event (E) — occurrence in time against an asset. Append-only. Canon: chittycanon://gov/governance#core-types';

-- =====================================================================
-- Warranties — Thing (T)
-- =====================================================================
CREATE TABLE IF NOT EXISTS warranties (
  id                  varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  chitty_id           varchar UNIQUE,
  asset_id            varchar NOT NULL REFERENCES assets(id),
  user_id             varchar NOT NULL REFERENCES users(id),
  provider            text NOT NULL,
  type                varchar NOT NULL,
  start_date          timestamptz NOT NULL,
  end_date            timestamptz NOT NULL,
  coverage            text,
  terms               text,
  cost                numeric(10,2),
  is_active           boolean DEFAULT true,
  notification_sent   boolean DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_warranties_asset_id ON warranties (asset_id);
CREATE INDEX IF NOT EXISTS idx_warranties_end_date ON warranties (end_date);
COMMENT ON TABLE warranties IS 'Thing (T) — contract-as-artifact granting coverage. The contract document is the Thing; coverage events are timeline_events. Canon: chittycanon://gov/governance#core-types';

-- =====================================================================
-- Insurance policies — Thing (T)
-- =====================================================================
CREATE TABLE IF NOT EXISTS insurance_policies (
  id                varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  chitty_id         varchar UNIQUE,
  asset_id          varchar NOT NULL REFERENCES assets(id),
  user_id           varchar NOT NULL REFERENCES users(id),
  provider          text NOT NULL,
  policy_number     varchar NOT NULL,
  type              varchar NOT NULL,
  coverage_amount   numeric(12,2),
  premium           numeric(10,2),
  deductible        numeric(10,2),
  start_date        timestamptz NOT NULL,
  end_date          timestamptz NOT NULL,
  is_active         boolean DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_insurance_policies_asset_id ON insurance_policies (asset_id);
CREATE INDEX IF NOT EXISTS idx_insurance_policies_policy_number ON insurance_policies (policy_number);
COMMENT ON TABLE insurance_policies IS 'Thing (T) — policy document as artifact. Claims/coverage events are recorded as timeline_events. Canon: chittycanon://gov/governance#core-types';

-- =====================================================================
-- Legal cases — Event (E)
-- =====================================================================
CREATE TABLE IF NOT EXISTS legal_cases (
  id              varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  chitty_id       varchar UNIQUE,
  user_id         varchar NOT NULL REFERENCES users(id),
  case_number     varchar,
  title           text NOT NULL,
  description     text,
  status          legal_case_status DEFAULT 'active',
  court           text,
  judge           text,
  filing_date     timestamptz,
  next_hearing    timestamptz,
  related_assets  text[],
  attorneys       jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_legal_cases_user_id ON legal_cases (user_id);
CREATE INDEX IF NOT EXISTS idx_legal_cases_status ON legal_cases (status);
COMMENT ON TABLE legal_cases IS 'Event (E) — legal proceeding with docket/status progression. Canon: chittycanon://gov/governance#core-types';

-- =====================================================================
-- AI analysis results — Event (E)
-- =====================================================================
CREATE TABLE IF NOT EXISTS ai_analysis_results (
  id              varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  chitty_id       varchar UNIQUE,
  evidence_id     varchar NOT NULL REFERENCES evidence(id),
  analysis_type   varchar NOT NULL,
  confidence      numeric(3,2),
  results         jsonb NOT NULL,
  processing_time integer,
  model_used      varchar,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_analysis_evidence_id ON ai_analysis_results (evidence_id);
CREATE INDEX IF NOT EXISTS idx_ai_analysis_results_gin ON ai_analysis_results USING GIN (results);
COMMENT ON TABLE ai_analysis_results IS 'Event (E) — AI analysis run in time against an evidence artifact. Append-only. Canon: chittycanon://gov/governance#core-types';

-- =====================================================================
-- updated_at trigger
-- =====================================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['users','assets','evidence','warranties','insurance_policies','legal_cases']
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%1$s_updated_at ON %1$s;
       CREATE TRIGGER trg_%1$s_updated_at BEFORE UPDATE ON %1$s
       FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t);
  END LOOP;
END $$;

COMMIT;
