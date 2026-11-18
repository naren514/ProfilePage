import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { WRITING_SETUP_STATEMENTS } from "@/lib/writing/setup-sql";
import { json, writingRoute } from "@/lib/writing/api";

export const dynamic = "force-dynamic";

/** Whether the Writing Studio tables exist. */
export async function GET() {
  return writingRoute(async () => {
    const result = await db.execute(sql`select to_regclass('public.writing_documents') is not null as ready`);
    const ready = Boolean((result.rows[0] as { ready?: boolean } | undefined)?.ready);
    return json({ ready });
  });
}

/** Create the Writing Studio tables. Safe to run more than once. */
export async function POST() {
  return writingRoute(async () => {
    for (const statement of WRITING_SETUP_STATEMENTS) {
      await db.execute(sql.raw(statement));
    }
    return json({ ready: true });
  });
}
