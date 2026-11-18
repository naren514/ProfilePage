import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { writingAgentRuns, writingApprovals, writingDocuments, writingIdeas } from "@/lib/db/schema";
import { pgErrorInfo } from "@/lib/http/errors";
import { documentStats, htmlToDocument } from "@/lib/writing/content";
import { getRun, logEvent, RunRejected } from "./runner";

/**
 * Create a new private draft from a finished Idea → outline run. Runs at most
 * once per run (the approval row's unique key), so retries and double clicks
 * return the same document.
 */
export async function createDocumentFromRun(runId: string, user: string): Promise<{ documentId: string }> {
  const run = await getRun(runId);
  if (!run) throw new RunRejected("NOT_FOUND", "Run not found.", 404);
  const existing = (run.result as { appliedDocumentId?: string } | null)?.appliedDocumentId;
  if (existing) return { documentId: existing };
  if (run.workflow !== "explore" || run.status !== "COMPLETED" || !run.result?.html) {
    throw new RunRejected("VALIDATION_FAILED", "Only a finished Idea → outline run can create a draft.", 400);
  }

  try {
    await db.insert(writingApprovals).values({
      runId,
      stepIndex: run.currentStep,
      kind: "apply:new_document",
      decision: { action: "create_document" },
      approvedBy: user,
      idempotencyKey: `apply:${runId}`,
    });
  } catch (error) {
    if (pgErrorInfo(error).code === "23505") {
      // Another request is creating it; wait briefly for its result
      for (let i = 0; i < 20; i++) {
        const again = await getRun(runId);
        const id = (again?.result as { appliedDocumentId?: string } | null)?.appliedDocumentId;
        if (id) return { documentId: id };
        await new Promise((r) => setTimeout(r, 250));
      }
      throw new RunRejected("EDIT_CONFLICT", "The draft is still being created. Refresh in a moment.", 409);
    }
    throw error;
  }

  const bodyJson = htmlToDocument(String(run.result.html));
  const { text, wordCount } = documentStats(bodyJson);
  const [doc] = await db
    .insert(writingDocuments)
    .values({
      ownerEmail: user,
      title: String(run.result.title ?? "").slice(0, 200),
      bodyJson,
      bodyText: text,
      wordCount,
      styleId: (run.input.styleId as string | undefined) ?? null,
    })
    .returning({ id: writingDocuments.id });

  await db
    .update(writingAgentRuns)
    .set({ result: { ...run.result, appliedDocumentId: doc.id }, documentId: doc.id, updatedAt: new Date() })
    .where(eq(writingAgentRuns.id, runId));
  if (run.ideaId) {
    await db
      .update(writingIdeas)
      .set({ status: "converted", linkedDocumentId: doc.id, updatedAt: new Date() })
      .where(eq(writingIdeas.id, run.ideaId));
  }
  await logEvent(runId, "applied", `Created a new draft from the outline (by ${user})`, { documentId: doc.id });
  return { documentId: doc.id };
}
