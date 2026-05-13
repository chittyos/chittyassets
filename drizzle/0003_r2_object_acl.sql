-- Migration 0003 — R2 object ACL
-- Replaces Google Cloud Storage objectStorage.ts ACL with a Neon-backed table.
-- File storage path is the R2 object key; ACL governs read/write per ChittyID.
-- Canon: chittycanon://gov/governance#core-types
-- This table itself is operational metadata (not an entity); rows describe
-- access grants from Person (P) principals onto Thing (T) artifacts.

BEGIN;

CREATE TYPE r2_acl_permission AS ENUM ('read','write','owner');

CREATE TABLE IF NOT EXISTS r2_object_acl (
  id              varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket          varchar NOT NULL,
  object_key      text    NOT NULL,
  principal_chitty_id varchar NOT NULL,            -- Person (P) ChittyID — soft ref to users.chitty_id
  permission      r2_acl_permission NOT NULL,
  granted_by_chitty_id varchar,                    -- Person (P) ChittyID — granting principal
  evidence_id     varchar REFERENCES evidence(id), -- nullable: scoped to an evidence artifact
  asset_id        varchar REFERENCES assets(id),   -- nullable: scoped to an asset
  expires_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  revoked_at      timestamptz,
  UNIQUE (bucket, object_key, principal_chitty_id, permission)
);
CREATE INDEX IF NOT EXISTS idx_r2_acl_principal ON r2_object_acl (principal_chitty_id);
CREATE INDEX IF NOT EXISTS idx_r2_acl_object ON r2_object_acl (bucket, object_key);
CREATE INDEX IF NOT EXISTS idx_r2_acl_evidence ON r2_object_acl (evidence_id);
CREATE INDEX IF NOT EXISTS idx_r2_acl_asset ON r2_object_acl (asset_id);

COMMENT ON TABLE r2_object_acl IS
  'Access control for R2 objects. Replaces GCS ACL. principal_chitty_id is a Person (P) ChittyID; '
  'evidence_id/asset_id scope the grant to a Thing (T) artifact. Soft ref to users.chitty_id (no FK '
  'because users.chitty_id is nullable during Phase 3 transition).';

COMMIT;
