import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { sql as sqlTag } from "drizzle-orm";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

// Production uses Neon over HTTP. DATABASE_DRIVER=pg switches to a plain
// Postgres connection for local development and end-to-end tests. It uses a
// single connection so the atomic() fallback below can wrap BEGIN/COMMIT.
export const usesPgDriver = process.env.DATABASE_DRIVER === "pg";

type Db = NeonHttpDatabase<typeof schema>;

export const db: Db = usesPgDriver
  ? (drizzlePg(new Pool({ connectionString: process.env.DATABASE_URL, max: 1 }), { schema }) as unknown as Db)
  : drizzle(neon(process.env.DATABASE_URL), { schema });

type BatchArg = Parameters<Db["batch"]>[0];

/**
 * Run several statements as one transaction: all of them apply, or none do.
 * Neon's HTTP driver has no interactive transactions, so this uses db.batch().
 */
export async function atomic<T extends BatchArg>(queries: T): Promise<Awaited<ReturnType<Db["batch"]>>> {
  if (!usesPgDriver) return db.batch(queries) as never;
  await db.execute(sqlTag`begin`);
  try {
    const results: unknown[] = [];
    for (const query of queries) results.push(await query);
    await db.execute(sqlTag`commit`);
    return results as never;
  } catch (error) {
    await db.execute(sqlTag`rollback`);
    throw error;
  }
}

export { schema };
