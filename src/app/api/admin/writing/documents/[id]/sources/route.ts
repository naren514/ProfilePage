import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { writingSources } from "@/lib/db/schema";
import { failureResponse, idSchema, json, writingRoute } from "@/lib/writing/api";

export const dynamic = "force-dynamic";

/** The research library for a post: every source actually retrieved for it. */
export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return writingRoute(async () => {
    if (!idSchema.safeParse(params.id).success) return failureResponse({ ok: false, reason: "not_found" });
    const sources = await db
      .select()
      .from(writingSources)
      .where(eq(writingSources.documentId, params.id))
      .orderBy(desc(writingSources.retrievedAt))
      .limit(200);
    return json({ sources });
  });
}
