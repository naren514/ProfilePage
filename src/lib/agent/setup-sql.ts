// Idempotent DDL for the autonomous agent (docs/writing-studio/agent-implementation-plan.md).
// Runs with the Writing Studio setup (POST /api/admin/writing/setup), like
// lib/writing/setup-sql.ts and lib/reading/setup-sql.ts. Keep in sync with
// writingAgentRuns in lib/db/schema.ts.

export const AGENT_READY_SQL = `select
  exists (select 1 from information_schema.columns
          where table_name = 'writing_agent_runs' and column_name = 'driver')
  and to_regclass('public.writing_triggers') is not null
  and to_regclass('public.writing_trigger_fires') is not null
  and to_regclass('public.writing_tool_calls') is not null
  and to_regclass('public.reading_candidates') is not null
  and to_regclass('public.reading_weekly_lists') is not null
  and to_regclass('public.reading_feed_items') is not null
  and to_regclass('public.reading_subscribers') is not null as ready`;

export const AGENT_SETUP_STATEMENTS: string[] = [
  // A0: measure how runs start and how long they actually work
  `ALTER TABLE writing_agent_runs ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'manual'`,
  `ALTER TABLE writing_agent_runs ADD COLUMN IF NOT EXISTS active_ms integer NOT NULL DEFAULT 0`,
  // A1: server-side runs and triggers
  `ALTER TABLE writing_agent_runs ADD COLUMN IF NOT EXISTS trigger_id uuid`,
  `ALTER TABLE writing_agent_runs ADD COLUMN IF NOT EXISTS autonomy_level text NOT NULL DEFAULT 'L1'`,
  `ALTER TABLE writing_agent_runs ADD COLUMN IF NOT EXISTS driver text NOT NULL DEFAULT 'browser'`,
  `CREATE INDEX IF NOT EXISTS writing_agent_runs_trigger_idx ON writing_agent_runs (trigger_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS writing_agent_runs_status_idx ON writing_agent_runs (status, updated_at)`,
  `CREATE TABLE IF NOT EXISTS writing_triggers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    key text UNIQUE,
    name text NOT NULL,
    description text NOT NULL DEFAULT '',
    kind text NOT NULL,
    schedule text,
    timezone text NOT NULL DEFAULT 'America/Los_Angeles',
    event text,
    workflow text NOT NULL,
    goal_template text NOT NULL DEFAULT '',
    input_template jsonb NOT NULL DEFAULT '{}',
    autonomy_level text NOT NULL DEFAULT 'L1',
    daily_budget_usd numeric(8,4) NOT NULL DEFAULT 0.5,
    enabled boolean NOT NULL DEFAULT false,
    next_run_at timestamp,
    last_fired_at timestamp,
    last_run_id uuid,
    last_status text,
    consecutive_failures integer NOT NULL DEFAULT 0,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS writing_trigger_fires (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    trigger_id uuid NOT NULL REFERENCES writing_triggers(id) ON DELETE CASCADE,
    fire_key text NOT NULL,
    run_id uuid,
    outcome text NOT NULL DEFAULT 'started',
    created_at timestamp NOT NULL DEFAULT now(),
    UNIQUE (trigger_id, fire_key)
  )`,
  // A2: one row per agent tool call (the audit trail behind each turn)
  `CREATE TABLE IF NOT EXISTS writing_tool_calls (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id uuid NOT NULL REFERENCES writing_agent_runs(id) ON DELETE CASCADE,
    turn integer NOT NULL,
    tool text NOT NULL,
    args jsonb NOT NULL DEFAULT '{}',
    args_hash text NOT NULL,
    ok boolean NOT NULL,
    error text,
    result_excerpt text NOT NULL DEFAULT '',
    result_hash text,
    ms integer NOT NULL DEFAULT 0,
    created_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS writing_tool_calls_run_idx ON writing_tool_calls (run_id, turn)`,
  `ALTER TABLE writing_agent_runs ADD COLUMN IF NOT EXISTS goal text`,
  // Idempotent inserts from runs (e.g. the digest adding an idea per saved article)
  `ALTER TABLE writing_ideas ADD COLUMN IF NOT EXISTS source_ref text`,
  `CREATE UNIQUE INDEX IF NOT EXISTS writing_ideas_source_ref_idx ON writing_ideas (source_ref) WHERE source_ref IS NOT NULL`,
  // A3: the weekly reading list (shortlist of found articles, and published lists)
  `CREATE TABLE IF NOT EXISTS reading_candidates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    url text NOT NULL,
    url_normalized text NOT NULL UNIQUE,
    title text NOT NULL DEFAULT '',
    publisher text NOT NULL DEFAULT '',
    published_date text,
    topic text NOT NULL DEFAULT '',
    excerpt text NOT NULL DEFAULT '',
    score numeric(4,2) NOT NULL DEFAULT 0,
    scores jsonb NOT NULL DEFAULT '{}',
    reason text NOT NULL DEFAULT '',
    read_in_full boolean NOT NULL DEFAULT false,
    status text NOT NULL DEFAULT 'active',
    run_id uuid,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS reading_candidates_status_idx ON reading_candidates (status, created_at)`,
  `CREATE TABLE IF NOT EXISTS reading_weekly_lists (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    week text NOT NULL UNIQUE,
    title text NOT NULL DEFAULT '',
    intro text NOT NULL DEFAULT '',
    picks jsonb NOT NULL DEFAULT '[]',
    run_id uuid,
    published_at timestamp NOT NULL DEFAULT now()
  )`,
  // Sources and their feeds (the weekly list's discovery)
  `CREATE TABLE IF NOT EXISTS reading_sources (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    url text NOT NULL UNIQUE,
    name text NOT NULL DEFAULT '',
    topic text NOT NULL DEFAULT '',
    feed_url text,
    status text NOT NULL DEFAULT 'new',
    last_error text,
    last_checked_at timestamp,
    last_item_count integer NOT NULL DEFAULT 0,
    created_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS reading_feed_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    url_normalized text NOT NULL UNIQUE,
    url text NOT NULL,
    title text NOT NULL DEFAULT '',
    summary text NOT NULL DEFAULT '',
    published_at timestamp,
    source_id uuid,
    source_name text NOT NULL DEFAULT '',
    topic text NOT NULL DEFAULT '',
    status text NOT NULL DEFAULT 'new',
    created_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS reading_feed_items_status_idx ON reading_feed_items (status, created_at)`,
  // Readers who get the weekly list by email (double opt-in)
  `CREATE TABLE IF NOT EXISTS reading_subscribers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL UNIQUE,
    status text NOT NULL DEFAULT 'pending',
    token text NOT NULL UNIQUE,
    created_at timestamp NOT NULL DEFAULT now(),
    confirm_sent_at timestamp,
    confirmed_at timestamp,
    unsubscribed_at timestamp
  )`,
  `ALTER TABLE reading_weekly_lists ADD COLUMN IF NOT EXISTS emailed_at timestamp`,
  `ALTER TABLE reading_weekly_lists ADD COLUMN IF NOT EXISTS emailed_count integer NOT NULL DEFAULT 0`,
];
