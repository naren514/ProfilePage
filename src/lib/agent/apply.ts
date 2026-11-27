import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { writingAgentRuns, writingApprovals, writingDocuments, writingIdeas, writingSources } from "@/lib/db/schema";
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
  if (!["explore", "deep_research"].includes(run.workflow) || run.status !== "COMPLETED" || !run.result?.html) {
    throw new RunRejected("VALIDATION_FAILED", "Only a finished outline or research report can start a draft.", 400);
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
  // A research report's sources start the new post's source library
  if (run.workflow === "deep_research") await copyRunSources(runId, doc.id);
  await logEvent(runId, "applied", `Created a new draft from the ${run.workflow === "deep_research" ? "research report" : "outline"} (by ${user})`, { documentId: doc.id });
  return { documentId: doc.id };
}

async function copyRunSources(runId: string, documentId: string) {
  const run = await getRun(runId);
  const used = new Set(((run?.result?.sources as Array<{ url: string }> | undefined) ?? []).map((s) => s.url));
  const rows = await db.select().from(writingSources).where(eq(writingSources.runId, runId));
  const keep = rows.filter((r) => used.has(r.url));
  if (keep.length) await db.insert(writingSources).values(keep.map(({ id: _id, ...r }) => ({ ...r, documentId })));
}

/** Save a finished research report as an idea (its title and summary, with its sources). */
export async function createIdeaFromRun(runId: string): Promise<{ ideaId: string }> {
  const run = await getRun(runId);
  if (!run) throw new RunRejected("NOT_FOUND", "Run not found.", 404);
  if (run.workflow !== "deep_research" || run.status !== "COMPLETED" || !run.result?.report) {
    throw new RunRejected("VALIDATION_FAILED", "Only a finished research report can be saved as an idea.", 400);
  }
  const report = run.result.report as { title: string; summary: string; sources: Array<{ ref: string; url: string; title: string; publisher: string }> };
  const [idea] = await db
    .insert(writingIdeas)
    .values({
      content: `${report.title}\n\n${report.summary}`.slice(0, 8000),
      sourceRef: `research:${runId}`,
      sources: report.sources.slice(0, 20).map((s) => ({ key: `run:${runId}:${s.ref}`, url: s.url, title: s.title, publisher: s.publisher })),
    })
    .onConflictDoNothing()
    .returning({ id: writingIdeas.id });
  if (idea) return { ideaId: idea.id };
  const [existing] = await db.select({ id: writingIdeas.id }).from(writingIdeas).where(eq(writingIdeas.sourceRef, `research:${runId}`)).limit(1);
  return { ideaId: existing.id };
}
