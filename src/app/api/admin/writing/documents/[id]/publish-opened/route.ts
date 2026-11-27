import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { writingDocuments } from "@/lib/db/schema";
import { apiError } from "@/lib/http/errors";
import { emitEvent } from "@/lib/agent/triggers";
import { idSchema, json, writingRoute } from "@/lib/writing/api";

export const dynamic = "force-dynamic";

/**
 * The editor tells the server the Publish dialog opened, so an enabled
 * "Fact-check when I open Publish" trigger can start. Once per revision.
 */
export async function POST(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return writingRoute(async () => {
    if (!idSchema.safeParse(params.id).success) return apiError("NOT_FOUND", "Document not found", 404);
    const [doc] = await db.select({ id: writingDocuments.id, revision: writingDocuments.currentRevision }).from(writingDocuments).where(eq(writingDocuments.id, params.id)).limit(1);
    if (!doc) return apiError("NOT_FOUND", "Document not found", 404);
    const outcomes = await emitEvent("publish.opened", { key: `${doc.id}:${doc.revision}`, documentId: doc.id });
    return json({ started: outcomes.filter((o) => o.status === "started").map((o) => (o as { runId: string }).runId) });
  });
}
