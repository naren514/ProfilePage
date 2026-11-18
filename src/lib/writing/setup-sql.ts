// Idempotent DDL for the Writing Studio tables. The production database isn't
// managed purely by drizzle migrations (the history has drifted), so the Studio
// creates its own tables, following the repo's existing setup-script pattern.
// Keep in sync with writingDocuments / writingRevisions in lib/db/schema.ts.
/** True when every Writing Studio table and column exists (current schema). */
export const SCHEMA_READY_SQL = `select
  to_regclass('public.writing_documents') is not null
  and to_regclass('public.writing_ai_usage') is not null
  and to_regclass('public.writing_styles') is not null
  and exists (select 1 from information_schema.columns
              where table_name = 'writing_documents' and column_name = 'style_id') as ready`;

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
  // M2: writing styles, AI suggestions, AI usage
  `CREATE TABLE IF NOT EXISTS writing_styles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text NOT NULL DEFAULT '',
    rules jsonb NOT NULL,
    example_document_ids uuid[] NOT NULL DEFAULT '{}',
    is_default boolean NOT NULL DEFAULT false,
    version integer NOT NULL DEFAULT 1,
    archived boolean NOT NULL DEFAULT false,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS writing_styles_one_default ON writing_styles (is_default) WHERE is_default`,
  `CREATE TABLE IF NOT EXISTS writing_style_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    style_id uuid NOT NULL REFERENCES writing_styles(id) ON DELETE CASCADE,
    version integer NOT NULL,
    name text NOT NULL,
    description text NOT NULL DEFAULT '',
    rules jsonb NOT NULL,
    example_document_ids uuid[] NOT NULL DEFAULT '{}',
    created_by text,
    created_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS writing_style_versions_style_idx ON writing_style_versions (style_id, version)`,
  `ALTER TABLE writing_documents ADD COLUMN IF NOT EXISTS style_id uuid REFERENCES writing_styles(id) ON DELETE SET NULL`,
  `CREATE TABLE IF NOT EXISTS writing_suggestions (
    id uuid PRIMARY KEY,
    document_id uuid NOT NULL REFERENCES writing_documents(id) ON DELETE CASCADE,
    base_revision integer NOT NULL,
    operation text NOT NULL,
    instruction text,
    style_id uuid,
    style_version integer,
    original_html text NOT NULL,
    proposal_html text NOT NULL DEFAULT '',
    final_html text,
    status text NOT NULL DEFAULT 'pending',
    provider text NOT NULL,
    model text NOT NULL,
    prompt_version text NOT NULL,
    input_tokens integer NOT NULL DEFAULT 0,
    output_tokens integer NOT NULL DEFAULT 0,
    created_at timestamp NOT NULL DEFAULT now(),
    resolved_at timestamp
  )`,
  `CREATE INDEX IF NOT EXISTS writing_suggestions_document_idx ON writing_suggestions (document_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS writing_ai_usage (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    operation text NOT NULL,
    provider text NOT NULL,
    model text NOT NULL,
    input_tokens integer NOT NULL DEFAULT 0,
    output_tokens integer NOT NULL DEFAULT 0,
    cost_usd numeric(12,6) NOT NULL DEFAULT 0,
    estimated boolean NOT NULL DEFAULT false,
    suggestion_id uuid,
    created_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS writing_ai_usage_created_idx ON writing_ai_usage (created_at)`,
  // Starter styles, only when there are none yet
  `INSERT INTO writing_styles (name, description, rules, is_default)
   SELECT * FROM (VALUES
     ('Reflective personal',
      'Personal reflections and lessons learned.',
      '{"voice":"First person, warm and honest. Sounds like talking to a thoughtful friend. Admit uncertainty where it exists.","sentences":"Mostly short to medium sentences. Short paragraphs of two to four sentences.","structure":"Open with a concrete moment or observation, then the insight. End with what changed or what I would tell my earlier self.","avoid":["corporate jargon","leverage","synergy","in today''s fast-paced world","hustle"],"other":"Prefer specific details over general claims."}'::jsonb,
      true),
     ('Technical deep-dive',
      'Explaining how something works or how a problem was solved.',
      '{"voice":"Precise, calm and practical. Confident without hype.","sentences":"Clear and direct. One idea per sentence. Define terms the first time they appear.","structure":"State the problem and why it matters, then the approach, trade-offs and results. Use headings and lists where they help scanning.","avoid":["revolutionary","game-changer","simply","just","obviously"],"other":"Use concrete examples, numbers and code names where relevant. Call out limitations honestly."}'::jsonb,
      false),
     ('Professional insight',
      'Opinions and observations about work, leadership and the industry.',
      '{"voice":"Confident and crisp, with a clear point of view. Professional but human.","sentences":"Tight sentences. No filler or throat-clearing.","structure":"Lead with the opinion in the first two sentences, support it with two or three reasons or examples, and end with a practical takeaway.","avoid":["thought leader","I am humbled","excited to announce","game-changer","delve"],"other":"Acknowledge the strongest counterargument briefly."}'::jsonb,
      false)
   ) AS seed(name, description, rules, is_default)
   WHERE NOT EXISTS (SELECT 1 FROM writing_styles)`,
];
