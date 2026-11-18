// Idempotent DDL for the Writing Studio tables. The production database isn't
// managed purely by drizzle migrations (the history has drifted), so the Studio
// creates its own tables, following the repo's existing setup-script pattern.
// Keep in sync with writingDocuments / writingRevisions in lib/db/schema.ts.
/** True when every Writing Studio table and column exists (current schema). */
export const SCHEMA_READY_SQL = `select
  to_regclass('public.writing_documents') is not null
  and to_regclass('public.writing_ai_usage') is not null
  and to_regclass('public.writing_styles') is not null
  and to_regclass('public.writing_messages') is not null
  and to_regclass('public.writing_samples') is not null
  and exists (select 1 from information_schema.columns
              where table_name = 'writing_suggestions' and column_name = 'reason')
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
  // M3: ideas, agent runs and their audit trail, research sources, chat
  `CREATE TABLE IF NOT EXISTS writing_ideas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    content text NOT NULL,
    tags text[] NOT NULL DEFAULT '{}',
    status text NOT NULL DEFAULT 'new',
    linked_document_id uuid REFERENCES writing_documents(id) ON DELETE SET NULL,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS writing_ideas_status_idx ON writing_ideas (status, created_at)`,
  `CREATE TABLE IF NOT EXISTS writing_agent_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow text NOT NULL,
    status text NOT NULL DEFAULT 'CREATED',
    document_id uuid REFERENCES writing_documents(id) ON DELETE SET NULL,
    idea_id uuid REFERENCES writing_ideas(id) ON DELETE SET NULL,
    input jsonb NOT NULL,
    state jsonb NOT NULL DEFAULT '{}',
    current_step integer NOT NULL DEFAULT 0,
    pending_approval jsonb,
    result jsonb,
    budget jsonb NOT NULL,
    usage jsonb NOT NULL,
    error text,
    cancel_requested boolean NOT NULL DEFAULT false,
    lock_token uuid,
    locked_at timestamp,
    created_by text,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now(),
    finished_at timestamp
  )`,
  `CREATE INDEX IF NOT EXISTS writing_agent_runs_document_idx ON writing_agent_runs (document_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS writing_agent_runs_created_idx ON writing_agent_runs (created_at)`,
  `CREATE TABLE IF NOT EXISTS writing_agent_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id uuid NOT NULL REFERENCES writing_agent_runs(id) ON DELETE CASCADE,
    type text NOT NULL,
    message text NOT NULL DEFAULT '',
    payload jsonb,
    created_at timestamp NOT NULL DEFAULT clock_timestamp()
  )`,
  `CREATE INDEX IF NOT EXISTS writing_agent_events_run_idx ON writing_agent_events (run_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS writing_approvals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id uuid NOT NULL REFERENCES writing_agent_runs(id) ON DELETE CASCADE,
    step_index integer NOT NULL,
    kind text NOT NULL,
    decision jsonb NOT NULL,
    approved_by text NOT NULL,
    idempotency_key text NOT NULL UNIQUE,
    created_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS writing_sources (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id uuid REFERENCES writing_documents(id) ON DELETE CASCADE,
    run_id uuid REFERENCES writing_agent_runs(id) ON DELETE SET NULL,
    url text NOT NULL,
    title text NOT NULL DEFAULT '',
    publisher text NOT NULL DEFAULT '',
    published_date text,
    excerpt text NOT NULL DEFAULT '',
    content_hash text NOT NULL,
    query text NOT NULL DEFAULT '',
    provider text NOT NULL DEFAULT 'tavily',
    retrieved_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS writing_sources_document_idx ON writing_sources (document_id, retrieved_at)`,
  `CREATE TABLE IF NOT EXISTS writing_conversations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id uuid NOT NULL REFERENCES writing_documents(id) ON DELETE CASCADE,
    title text NOT NULL DEFAULT '',
    archived boolean NOT NULL DEFAULT false,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS writing_conversations_document_idx ON writing_conversations (document_id, updated_at)`,
  `CREATE TABLE IF NOT EXISTS writing_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id uuid NOT NULL REFERENCES writing_conversations(id) ON DELETE CASCADE,
    role text NOT NULL,
    content text NOT NULL,
    model text,
    created_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS writing_messages_conversation_idx ON writing_messages (conversation_id, created_at)`,
  // M4: writing memory
  `CREATE TABLE IF NOT EXISTS writing_samples (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    content text NOT NULL,
    label text NOT NULL DEFAULT '',
    source_document_id uuid REFERENCES writing_documents(id) ON DELETE SET NULL,
    source_title text NOT NULL DEFAULT '',
    note text NOT NULL DEFAULT '',
    style_ids uuid[] NOT NULL DEFAULT '{}',
    enabled boolean NOT NULL DEFAULT true,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS writing_samples_created_idx ON writing_samples (created_at)`,
  // Full-text index used to pick the samples most relevant to a passage
  `CREATE INDEX IF NOT EXISTS writing_samples_search_idx ON writing_samples USING gin (to_tsvector('english', content))`,
  `ALTER TABLE writing_suggestions ADD COLUMN IF NOT EXISTS reason text`,
  `ALTER TABLE writing_style_versions ADD COLUMN IF NOT EXISTS note text`,
  `ALTER TABLE writing_style_versions ADD COLUMN IF NOT EXISTS source_run_id uuid`,
];
