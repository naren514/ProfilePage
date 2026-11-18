import JSZip from "jszip";
import { asc } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  stories,
  writingAgentEvents,
  writingAgentRuns,
  writingAiUsage,
  writingDocuments,
  writingIdeas,
  writingRevisions,
  writingSamples,
  writingSources,
  writingStyles,
  writingStyleVersions,
} from "@/lib/db/schema";
import { OPERATIONS } from "./ai/operations";
import { CHAT_SYSTEM_PROMPT } from "./ai/chat";
import { PROMPT_VERSION, REWRITE_SYSTEM_PROMPT } from "./ai/prompts";
import { WORKFLOW_SYSTEM } from "@/lib/agent/workflows/shared";
import { listFeedback } from "./memory/feedback";
import { documentMedia, postToMarkdown, toCsv } from "./markdown";

const README = `# Writing Studio export

Everything the Writing Studio stores, in open formats.

- posts/<slug>--<id>/post.md         Readable copy (Markdown with front matter)
- posts/<slug>--<id>/post.json       The lossless original (editor JSON and all fields)
- posts/<slug>--<id>/revisions.json  Version history, oldest first
- posts/<slug>--<id>/live.json       The public copy, if the post was ever published
- ideas.json                         Idea inbox (original wording)
- sources.json, sources.csv          Research sources: URL, publisher, when retrieved, the text retrieved
- styles.json                        Writing styles with every version
- samples.json                       Writing samples with provenance
- feedback.json, feedback.csv        What happened to each AI suggestion
- agent-runs.json, agent-runs.csv    Workflow runs with their full event log and approvals
- ai-usage.csv                       Every AI call and web search, with tokens and estimated cost
- prompts/                           The prompts the Studio sends to the AI
- media.json                         Every image URL used by a post (hosted on Vercel Blob)
- manifest.json                      What's in this file, with counts

Markdown is the portable copy; post.json is the one to import from, since
Markdown can't represent everything (for example underline, image sizes).
`;

function folderName(slug: string | null, id: string) {
  const base = (slug || "untitled").replace(/[^a-z0-9-]/gi, "-").slice(0, 80);
  return `${base}--${id.slice(0, 8)}`;
}

export async function buildExport(): Promise<{ zip: Uint8Array; filename: string; counts: Record<string, number> }> {
  const [docs, revisions, live, ideas, sources, styles, styleVersions, samples, runs, events, usage, feedback] = await Promise.all([
    db.select().from(writingDocuments).orderBy(asc(writingDocuments.createdAt)),
    db.select().from(writingRevisions).orderBy(asc(writingRevisions.createdAt)),
    db.select().from(stories),
    db.select().from(writingIdeas).orderBy(asc(writingIdeas.createdAt)),
    db.select().from(writingSources).orderBy(asc(writingSources.retrievedAt)),
    db.select().from(writingStyles).orderBy(asc(writingStyles.createdAt)),
    db.select().from(writingStyleVersions).orderBy(asc(writingStyleVersions.createdAt)),
    db.select().from(writingSamples).orderBy(asc(writingSamples.createdAt)),
    db.select().from(writingAgentRuns).orderBy(asc(writingAgentRuns.createdAt)),
    db.select().from(writingAgentEvents).orderBy(asc(writingAgentEvents.createdAt)),
    db.select().from(writingAiUsage).orderBy(asc(writingAiUsage.createdAt)),
    listFeedback({ limit: 100_000 }),
  ]);

  const zip = new JSZip();
  const json = (value: unknown) => JSON.stringify(value, null, 2);
  const media = new Map<string, string[]>();
  const liveById = new Map(live.map((s) => [s.id, s]));
  const files: string[] = [];
  const add = (name: string, content: string) => {
    zip.file(name, content);
    files.push(name);
  };

  for (const doc of docs) {
    const dir = `posts/${folderName(doc.slug, doc.id)}`;
    const { lastSnapshotAt: _snap, ...fields } = doc;
    add(`${dir}/post.md`, postToMarkdown(doc));
    add(`${dir}/post.json`, json(fields));
    add(`${dir}/revisions.json`, json(revisions.filter((r) => r.documentId === doc.id)));
    const story = doc.storyId ? liveById.get(doc.storyId) : undefined;
    if (story) add(`${dir}/live.json`, json(story));
    for (const url of documentMedia(doc.bodyJson)) media.set(url, [...(media.get(url) ?? []), doc.id]);
  }

  add("ideas.json", json(ideas));
  add("sources.json", json(sources));
  add("sources.csv", toCsv(sources, ["id", "documentId", "url", "title", "publisher", "publishedDate", "retrievedAt", "query", "excerpt"]));
  add("styles.json", json(styles.map((s) => ({ ...s, history: styleVersions.filter((v) => v.styleId === s.id) }))));
  add("samples.json", json(samples));
  add("feedback.json", json(feedback));
  add(
    "feedback.csv",
    toCsv(feedback, ["id", "documentTitle", "operation", "status", "reason", "original", "proposal", "final", "model", "createdAt", "resolvedAt"])
  );
  const eventsByRun = new Map<string, typeof events>();
  for (const e of events) eventsByRun.set(e.runId, [...(eventsByRun.get(e.runId) ?? []), e]);
  add(
    "agent-runs.json",
    json(runs.map(({ lockToken: _t, lockedAt: _l, ...r }) => ({ ...r, events: eventsByRun.get(r.id) ?? [] })))
  );
  add(
    "agent-runs.csv",
    toCsv(
      runs.map((r) => ({ ...r, costUsd: r.usage.costUsd, modelCalls: r.usage.modelCalls, toolCalls: r.usage.toolCalls })),
      ["id", "workflow", "status", "documentId", "modelCalls", "toolCalls", "costUsd", "error", "createdAt", "finishedAt"]
    )
  );
  add("ai-usage.csv", toCsv(usage, ["createdAt", "operation", "provider", "model", "inputTokens", "outputTokens", "costUsd", "estimated", "suggestionId"]));
  add("prompts/rewrite-system.md", `<!-- ${PROMPT_VERSION} -->\n${REWRITE_SYSTEM_PROMPT}\n`);
  add("prompts/rewrite-operations.json", json(OPERATIONS));
  add("prompts/workflow-system.md", `${WORKFLOW_SYSTEM}\n`);
  add("prompts/chat-system.md", `${CHAT_SYSTEM_PROMPT}\n`);
  add("media.json", json(Array.from(media.entries()).map(([url, documentIds]) => ({ url, documentIds }))));
  add("README.md", README);

  const counts = {
    posts: docs.length,
    revisions: revisions.length,
    ideas: ideas.length,
    sources: sources.length,
    styles: styles.length,
    samples: samples.length,
    feedback: feedback.length,
    agentRuns: runs.length,
    media: media.size,
  };
  zip.file("manifest.json", json({ format: "writing-studio-export", version: 1, exportedAt: new Date().toISOString(), counts, files: [...files, "manifest.json"] }));

  const date = new Date().toISOString().slice(0, 10);
  return {
    zip: await zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 6 } }),
    filename: `writing-studio-export-${date}.zip`,
    counts,
  };
}
