-- Migration 0002 — Canonical entities registry
-- Soft references only: per-service tables do NOT FK to this registry.
-- The registry is a discovery/audit index, populated by app-layer triggers
-- or batch reconciliation. Schema authority is per-table.
-- Canon: chittycanon://gov/governance#core-types

BEGIN;

CREATE TYPE entity_type AS ENUM ('P','L','T','E','A');
COMMENT ON TYPE entity_type IS
  'Canonical ChittyOS entity types per chittycanon://gov/governance#core-types: '
  'P=Person, L=Location, T=Thing, E=Event, A=Authority. All five MUST be present; never omit A.';

CREATE TABLE IF NOT EXISTS entities (
  chitty_id      varchar PRIMARY KEY,
  entity_type    entity_type NOT NULL,
  source_table   varchar NOT NULL,
  source_id      varchar NOT NULL,
  display_name   text,
  metadata       jsonb,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  deleted_at     timestamptz,
  UNIQUE (source_table, source_id)
);
CREATE INDEX IF NOT EXISTS idx_entities_type ON entities (entity_type);
CREATE INDEX IF NOT EXISTS idx_entities_source ON entities (source_table, source_id);
CREATE INDEX IF NOT EXISTS idx_entities_metadata_gin ON entities USING GIN (metadata);

COMMENT ON TABLE entities IS
  'Canonical discovery/audit index of all ChittyID-bearing entities in this service. '
  'Soft-reference only: per-service tables do NOT FK here. Populated by app layer.';
COMMENT ON COLUMN entities.entity_type IS
  '@canon: chittycanon://gov/governance#core-types — one of P/L/T/E/A. Never include "Entity" as a value (circular).';

CREATE TRIGGER trg_entities_updated_at
BEFORE UPDATE ON entities
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
