import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { SCHEMA_READY_SQL, WRITING_SETUP_STATEMENTS } from "@/lib/writing/setup-sql";
import { READING_READY_SQL, READING_SETUP_STATEMENTS } from "@/lib/reading/setup-sql";
import { AGENT_READY_SQL, AGENT_SETUP_STATEMENTS } from "@/lib/agent/setup-sql";
import { json, writingRoute } from "@/lib/writing/api";

export const dynamic = "force-dynamic";

/** Whether the Writing Studio tables exist. */
export async function GET() {
  return writingRoute(async () => {
    const result = await db.execute(sql.raw(SCHEMA_READY_SQL));
    const reading = await db.execute(sql.raw(READING_READY_SQL));
    const agent = await db.execute(sql.raw(AGENT_READY_SQL));
    const ready = [result, reading, agent].every((r) => Boolean((r.rows[0] as { ready?: boolean } | undefined)?.ready));
    return json({ ready });
  });
}

/** Create the Writing Studio and Reading list tables. Safe to run more than once. */
export async function POST() {
  return writingRoute(async () => {
    for (const statement of [...WRITING_SETUP_STATEMENTS, ...READING_SETUP_STATEMENTS, ...AGENT_SETUP_STATEMENTS]) {
      await db.execute(sql.raw(statement));
    }
    return json({ ready: true });
  });
}
