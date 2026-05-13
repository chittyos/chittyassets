# Phase 3 — Migrate users.id from uuid to canonical ChittyID

**Status:** Planned, not executed. Document only.
**Canon:** chittycanon://gov/governance#core-types
**Target:** Neon project `steep-cloud-28172078`

## Rationale

Phase 1 (this PR) keeps `users.id` as a uuid PK and adds nullable `users.chitty_id`. This is
backward-compatible: existing Replit-Auth-emitted user records (if any are seeded from the
legacy stack) continue to work; new ChittyAuth flows populate `chitty_id` immediately.

Phase 3 promotes `chitty_id` to the canonical PK and rewires all FK references. It is a
breaking change at the DB layer and MUST be coordinated with all consumers:

- Worker `worker/src/auth.ts` (claims → user lookup)
- Express `server/storage.ts` (legacy)
- Any downstream service that reads `users.id` via shared Neon access

## Pre-conditions

1. ChittyAuth issues `sub = chitty_id` for every authenticated principal.
2. All existing users in production have `users.chitty_id IS NOT NULL`.
3. Worker no longer reads `users.id` — only `users.chitty_id`.
4. All FK tables (`assets.user_id`, `evidence.user_id`, etc.) have a `user_chitty_id varchar`
   column shadowing the uuid (added in a prior, separate migration).

## The 5-step migration

### Step 1 — Backfill `user_chitty_id` on all FK tables

```sql
BEGIN;
UPDATE assets a              SET user_chitty_id = u.chitty_id FROM users u WHERE a.user_id = u.id;
UPDATE evidence e            SET user_chitty_id = u.chitty_id FROM users u WHERE e.user_id = u.id;
UPDATE timeline_events t     SET user_chitty_id = u.chitty_id FROM users u WHERE t.user_id = u.id;
UPDATE warranties w          SET user_chitty_id = u.chitty_id FROM users u WHERE w.user_id = u.id;
UPDATE insurance_policies i  SET user_chitty_id = u.chitty_id FROM users u WHERE i.user_id = u.id;
UPDATE legal_cases l         SET user_chitty_id = u.chitty_id FROM users u WHERE l.user_id = u.id;

-- Validate: zero NULLs
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM assets WHERE user_chitty_id IS NULL)
  OR EXISTS (SELECT 1 FROM evidence WHERE user_chitty_id IS NULL)
  OR EXISTS (SELECT 1 FROM timeline_events WHERE user_chitty_id IS NULL)
  OR EXISTS (SELECT 1 FROM warranties WHERE user_chitty_id IS NULL)
  OR EXISTS (SELECT 1 FROM insurance_policies WHERE user_chitty_id IS NULL)
  OR EXISTS (SELECT 1 FROM legal_cases WHERE user_chitty_id IS NULL)
  THEN RAISE EXCEPTION 'Backfill incomplete'; END IF;
END $$;
COMMIT;
```

### Step 2 — Add new FK constraints alongside legacy ones

```sql
BEGIN;
ALTER TABLE assets             ADD CONSTRAINT fk_assets_user_chitty             FOREIGN KEY (user_chitty_id) REFERENCES users(chitty_id);
ALTER TABLE evidence           ADD CONSTRAINT fk_evidence_user_chitty           FOREIGN KEY (user_chitty_id) REFERENCES users(chitty_id);
ALTER TABLE timeline_events    ADD CONSTRAINT fk_timeline_user_chitty           FOREIGN KEY (user_chitty_id) REFERENCES users(chitty_id);
ALTER TABLE warranties         ADD CONSTRAINT fk_warranties_user_chitty        FOREIGN KEY (user_chitty_id) REFERENCES users(chitty_id);
ALTER TABLE insurance_policies ADD CONSTRAINT fk_insurance_user_chitty         FOREIGN KEY (user_chitty_id) REFERENCES users(chitty_id);
ALTER TABLE legal_cases        ADD CONSTRAINT fk_legal_cases_user_chitty       FOREIGN KEY (user_chitty_id) REFERENCES users(chitty_id);
COMMIT;
```

### Step 3 — Cut over Worker code

Deploy a Worker release that reads exclusively `user_chitty_id`. Old uuid `user_id`
columns remain populated but unread. **Bake time: minimum 7 days** to catch stragglers.

### Step 4 — Drop legacy FK + uuid columns

```sql
BEGIN;
ALTER TABLE assets             DROP CONSTRAINT assets_user_id_fkey;
ALTER TABLE assets             DROP COLUMN user_id;
ALTER TABLE evidence           DROP CONSTRAINT evidence_user_id_fkey;
ALTER TABLE evidence           DROP COLUMN user_id;
-- ...repeat for each table
ALTER TABLE users              DROP CONSTRAINT users_pkey;
ALTER TABLE users              ALTER COLUMN chitty_id SET NOT NULL;
ALTER TABLE users              ADD CONSTRAINT users_pkey PRIMARY KEY (chitty_id);
ALTER TABLE users              DROP COLUMN id;
COMMIT;
```

### Step 5 — Rename `user_chitty_id` → `user_id` everywhere

```sql
BEGIN;
ALTER TABLE assets             RENAME COLUMN user_chitty_id TO user_id;
ALTER TABLE evidence           RENAME COLUMN user_chitty_id TO user_id;
ALTER TABLE timeline_events    RENAME COLUMN user_chitty_id TO user_id;
ALTER TABLE warranties         RENAME COLUMN user_chitty_id TO user_id;
ALTER TABLE insurance_policies RENAME COLUMN user_chitty_id TO user_id;
ALTER TABLE legal_cases        RENAME COLUMN user_chitty_id TO user_id;
COMMIT;
```

## Rollback

Any step is reversible until Step 4 commits. After Step 4, restore from the pre-step-4
Neon branch (Neon's point-in-time restore retains 7 days by default; verify before
executing).

## Validation

After Step 5, every row in every per-service table MUST have `user_id` matching
`/^[0-9]{2}-[A-Z]-[0-9]{3}-[0-9]{4}-[PLTEA]-[0-9]{4}-[A-Z]-[0-9]$/` (the canonical
ChittyID regex including all five P/L/T/E/A types).
