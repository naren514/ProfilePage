// Idempotent DDL for the Reading list inbox. Runs with the Writing Studio
// setup (POST /api/admin/writing/setup). Keep in sync with `certifications`
// and `apiTokens` in lib/db/schema.ts.

export const READING_READY_SQL = `select
  to_regclass('public.api_tokens') is not null
  and exists (select 1 from information_schema.columns
              where table_name = 'certifications' and column_name = 'url_normalized')
  and exists (select 1 from information_schema.columns
              where table_name = 'certifications' and column_name = 'suggested_tags') as ready`;

export const READING_SETUP_STATEMENTS: string[] = [
  // The table predates the inbox; create it on databases that never had it
  `CREATE TABLE IF NOT EXISTS certifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    issuer text NOT NULL,
    credential_id text,
    credential_url text,
    issue_date date NOT NULL,
    expiration_date date,
    badge_url text,
    is_active boolean NOT NULL DEFAULT true,
    sort_order integer DEFAULT 0,
    created_at timestamp NOT NULL DEFAULT now()
  )`,
  `ALTER TABLE certifications ADD COLUMN IF NOT EXISTS status text`,
  `ALTER TABLE certifications ADD COLUMN IF NOT EXISTS note text`,
  `ALTER TABLE certifications ADD COLUMN IF NOT EXISTS suggested_note text`,
  `ALTER TABLE certifications ADD COLUMN IF NOT EXISTS quote text`,
  `ALTER TABLE certifications ADD COLUMN IF NOT EXISTS image_url text`,
  `ALTER TABLE certifications ADD COLUMN IF NOT EXISTS site_name text`,
  `ALTER TABLE certifications ADD COLUMN IF NOT EXISTS author text`,
  `ALTER TABLE certifications ADD COLUMN IF NOT EXISTS saved_via text`,
  `ALTER TABLE certifications ADD COLUMN IF NOT EXISTS url_normalized text`,
  `ALTER TABLE certifications ADD COLUMN IF NOT EXISTS saved_at timestamp DEFAULT now()`,
  `ALTER TABLE certifications ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}'`,
  `ALTER TABLE certifications ADD COLUMN IF NOT EXISTS suggested_tags text[] NOT NULL DEFAULT '{}'`,
  // Backfill existing entries once: active ones are published, the rest archived;
  // the old excerpt becomes the note.
  `UPDATE certifications SET status = CASE WHEN is_active THEN 'published' ELSE 'archived' END WHERE status IS NULL`,
  `UPDATE certifications SET note = credential_id WHERE note IS NULL AND credential_id IS NOT NULL`,
  `UPDATE certifications SET saved_at = created_at WHERE saved_at IS NULL`,
  `ALTER TABLE certifications ALTER COLUMN status SET DEFAULT 'published'`,
  `ALTER TABLE certifications ALTER COLUMN status SET NOT NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS certifications_url_normalized_idx ON certifications (url_normalized) WHERE url_normalized IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS certifications_status_idx ON certifications (status, saved_at)`,
  `CREATE TABLE IF NOT EXISTS api_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    token_hash text NOT NULL UNIQUE,
    scope text NOT NULL,
    last_used_at timestamp,
    created_at timestamp NOT NULL DEFAULT now(),
    revoked_at timestamp
  )`,
];
