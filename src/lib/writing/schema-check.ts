import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { SCHEMA_READY_SQL } from "./setup-sql";

let confirmedReady = false;

/** Whether setup has run for the current schema. Cached once true. */
export async function isSchemaReady(): Promise<boolean> {
  if (confirmedReady) return true;
  const result = await db.execute(sql.raw(SCHEMA_READY_SQL));
  confirmedReady = Boolean((result.rows[0] as { ready?: boolean } | undefined)?.ready);
  return confirmedReady;
}
