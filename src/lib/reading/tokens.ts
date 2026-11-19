import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { apiTokens } from "@/lib/db/schema";
import { READING_SCOPE, generateToken, hashToken } from "./token-format";

export { READING_SCOPE, bearerToken, generateToken, hashToken } from "./token-format";

/** Create a token; the plain value is returned once and never stored. */
export async function createToken(name: string) {
  const token = generateToken();
  const [row] = await db.insert(apiTokens).values({ name, tokenHash: hashToken(token), scope: READING_SCOPE }).returning();
  return { token, id: row.id, name: row.name, createdAt: row.createdAt };
}

export async function listTokens() {
  return db
    .select({ id: apiTokens.id, name: apiTokens.name, lastUsedAt: apiTokens.lastUsedAt, createdAt: apiTokens.createdAt, revokedAt: apiTokens.revokedAt })
    .from(apiTokens)
    .where(eq(apiTokens.scope, READING_SCOPE))
    .orderBy(desc(apiTokens.createdAt));
}

export async function revokeToken(id: string): Promise<boolean> {
  const rows = await db.update(apiTokens).set({ revokedAt: new Date() }).where(and(eq(apiTokens.id, id), isNull(apiTokens.revokedAt))).returning({ id: apiTokens.id });
  return rows.length > 0;
}

/** Look up an active token by its hash (the lookup is on a SHA-256, so timing reveals nothing useful). */
export async function verifyToken(token: string, scope = READING_SCOPE) {
  const [row] = await db
    .select()
    .from(apiTokens)
    .where(and(eq(apiTokens.tokenHash, hashToken(token)), eq(apiTokens.scope, scope), isNull(apiTokens.revokedAt)))
    .limit(1);
  if (!row) return null;
  await db.update(apiTokens).set({ lastUsedAt: new Date() }).where(eq(apiTokens.id, row.id)).catch(() => {});
  return row;
}
