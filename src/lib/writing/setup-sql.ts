// Idempotent DDL for the Writing Studio tables. The production database isn't
// managed purely by drizzle migrations (the history has drifted), so the Studio
// creates its own tables, following the repo's existing setup-script pattern.
// Keep in sync with writingDocuments / writingRevisions in lib/db/schema.ts.
export const WRITING_SETUP_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS writing_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_email text NOT NULL,
    title text NOT NULL DEFAULT '',
    slug varchar(255),
    excerpt text NOT NULL DEFAULT '',
    status text NOT NULL DEFAULT 'DRAFT',
    body_json jsonb NOT NULL,
    body_text text NOT NULL DEFAULT '',
    word_count integer NOT NULL DEFAULT 0,
    tags text[] NOT NULL DEFAULT '{}',
    post_date date,
    current_revision integer NOT NULL DEFAULT 1,
    published_revision integer,
    story_id uuid UNIQUE REFERENCES stories(id) ON DELETE SET NULL,
    source text NOT NULL DEFAULT 'studio',
    published_at timestamp,
    story_synced_at timestamp,
    last_snapshot_at timestamp,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now(),
    CONSTRAINT writing_documents_status_check
      CHECK (status IN ('IDEA','DRAFT','IN_REVIEW','READY_TO_PUBLISH','PUBLISHED','ARCHIVED'))
  )`,
  `CREATE INDEX IF NOT EXISTS writing_documents_status_idx ON writing_documents (status)`,
  `CREATE INDEX IF NOT EXISTS writing_documents_updated_idx ON writing_documents (updated_at)`,
  `CREATE TABLE IF NOT EXISTS writing_revisions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id uuid NOT NULL REFERENCES writing_documents(id) ON DELETE CASCADE,
    revision_number integer NOT NULL,
    title text NOT NULL DEFAULT '',
    excerpt text NOT NULL DEFAULT '',
    body_json jsonb NOT NULL,
    word_count integer NOT NULL DEFAULT 0,
    change_origin text NOT NULL,
    legacy_html text,
    published_slug varchar(255),
    idempotency_key text UNIQUE,
    created_by text,
    created_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS writing_revisions_document_idx ON writing_revisions (document_id, created_at)`,
];
