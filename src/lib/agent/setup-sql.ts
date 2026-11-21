// Idempotent DDL for the autonomous agent (docs/writing-studio/agent-implementation-plan.md).
// Runs with the Writing Studio setup (POST /api/admin/writing/setup), like
// lib/writing/setup-sql.ts and lib/reading/setup-sql.ts. Keep in sync with
// writingAgentRuns in lib/db/schema.ts.

export const AGENT_READY_SQL = `select
  exists (select 1 from information_schema.columns
          where table_name = 'writing_agent_runs' and column_name = 'active_ms') as ready`;

export const AGENT_SETUP_STATEMENTS: string[] = [
  // A0: measure how runs start and how long they actually work
  `ALTER TABLE writing_agent_runs ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'manual'`,
  `ALTER TABLE writing_agent_runs ADD COLUMN IF NOT EXISTS active_ms integer NOT NULL DEFAULT 0`,
];
