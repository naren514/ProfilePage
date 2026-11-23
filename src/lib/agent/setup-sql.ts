// Idempotent DDL for the autonomous agent (docs/writing-studio/agent-implementation-plan.md).
// Runs with the Writing Studio setup (POST /api/admin/writing/setup), like
// lib/writing/setup-sql.ts and lib/reading/setup-sql.ts. Keep in sync with
// writingAgentRuns in lib/db/schema.ts.

export const AGENT_READY_SQL = `select
  exists (select 1 from information_schema.columns
          where table_name = 'writing_agent_runs' and column_name = 'driver')
  and to_regclass('public.writing_triggers') is not null
  and to_regclass('public.writing_trigger_fires') is not null
  and to_regclass('public.writing_tool_calls') is not null as ready`;

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
];
