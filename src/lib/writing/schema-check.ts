import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { AGENT_READY_SQL } from "@/lib/agent/setup-sql";
import { SCHEMA_READY_SQL } from "./setup-sql";

let confirmedReady = false;

/** Whether setup has run for the current schema. Cached once true. */
export async function isSchemaReady(): Promise<boolean> {
  if (confirmedReady) return true;
  // The agent columns are part of the Studio schema too: agent runs read them
  const results = await Promise.all([db.execute(sql.raw(SCHEMA_READY_SQL)), db.execute(sql.raw(AGENT_READY_SQL))]);
  confirmedReady = results.every((r) => Boolean((r.rows[0] as { ready?: boolean } | undefined)?.ready));
  return confirmedReady;
}
