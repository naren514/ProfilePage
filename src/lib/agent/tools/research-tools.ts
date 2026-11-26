import { createHash } from "crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { writingSources } from "@/lib/db/schema";
import { resolveCitations, type StoredSource } from "../workflows/research";
import { fence } from "../workflows/shared";
import { defineTool, type AgentSource, type AgentState, type ToolDef, type ToolResult } from "./registry";
import type { StepContext } from "../types";
import type { SearchResult } from "../tavily";

// Tools for the Research playbook (agent PRD A2). Search results become the
// run's sources (S1, S2, …). web.fetch can only read a page that a search
// returned, by its reference: the model can't be talked into fetching an
// address planted in a page or in the author's text.

const MAX_SOURCES = 16;
const PAGE_CHARS = 6000;

export function publisherOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

const sourceLine = (s: AgentSource) => `[${s.ref}] ${s.title} (${s.publisher}${s.publishedDate ? `, ${s.publishedDate}` : ""})${s.pageText ? " — read in full" : ""}`;

export const webSearch = defineTool({
  name: "web.search",
  description: "Search the web. New results are added to your sources as S1, S2, … Use specific queries; search again with different words when results are thin or one-sided.",
  risk: "read",
  args: z.object({ query: z.string().trim().min(2).max(300) }),
  example: '{"query":"…"}',
  async run(ctx, args, state) {
    const results = await ctx.search(args.query);
    return registerSources(ctx, state, results, args.query);
  },
});

/** Add search results to the run's sources (S1, S2, …) and describe the new ones to the model. */
export async function registerSources(ctx: StepContext, state: AgentState, results: SearchResult[], query: string, skip?: (url: string) => string | null): Promise<ToolResult> {
  const added: AgentSource[] = [];
  const skipped: string[] = [];
  for (const r of results) {
    if (state.sources.length >= MAX_SOURCES) break;
    if (state.sources.some((s) => s.url === r.url)) continue;
    const why = skip?.(r.url);
    if (why) {
      skipped.push(`${publisherOf(r.url)} (${why})`);
      continue;
    }
    const contentHash = createHash("sha256").update(r.content).digest("hex");
    const [existing] = await db
      .select({ id: writingSources.id })
      .from(writingSources)
      .where(and(eq(writingSources.runId, ctx.run.id), eq(writingSources.url, r.url)))
      .limit(1);
    const id =
      existing?.id ??
      (
        await db
          .insert(writingSources)
          .values({ documentId: ctx.run.documentId, runId: ctx.run.id, url: r.url, title: r.title, publisher: publisherOf(r.url), publishedDate: r.publishedDate, excerpt: r.content, contentHash, query })
          .returning({ id: writingSources.id })
      )[0].id;
    const source: AgentSource = { id, ref: `S${state.sources.length + 1}`, url: r.url, title: r.title, publisher: publisherOf(r.url), excerpt: r.content.slice(0, 1200), publishedDate: r.publishedDate, query };
    state.sources.push(source);
    added.push(source);
  }
  const skipNote = skipped.length ? ` Skipped: ${skipped.join("; ")}.` : "";
  if (added.length === 0) return { ok: true, observation: `No new sources for "${query}" (${results.length} result(s), all already seen, skipped or none found).${skipNote} Try different words, or work with what you have.` };
  const text = added.map((s) => `${sourceLine(s)}\n${s.excerpt.slice(0, 400)}`).join("\n\n");
  return { ok: true, progress: true, observation: `${added.length} new source(s):\n${fence("sources", text, 6000)}${skipNote}` };
}

export const webFetch = defineTool({
  name: "web.fetch",
  description: "Read one of your sources in full, by its reference (e.g. S2). Do this when a snippet isn't enough to support a claim.",
  risk: "read",
  args: z.object({ source: z.string().trim().regex(/^S\d{1,2}$/i, "Use a source reference like S2 (only pages your searches returned can be read).") }),
  example: '{"source":"S2"}',
  async run(ctx, args, state) {
    const ref = args.source.toUpperCase();
    const source = state.sources.find((s) => s.ref === ref);
    if (!source) return { ok: false, observation: `There is no source ${ref}. Your sources: ${state.sources.map((s) => s.ref).join(", ") || "none yet (search first)"}.` };
    if (source.pageText) return { ok: true, observation: `You already read ${ref}. Its text is in an earlier observation.` };
    const page = await ctx.fetchPage(source.url);
    source.pageText = page.text.slice(0, PAGE_CHARS);
    if (page.title && !source.title) source.title = page.title;
    return { ok: true, progress: true, observation: `${ref} in full:\n${fence("sources", `[${ref}] ${source.title}\n${source.pageText}`, PAGE_CHARS + 400)}` };
  },
});

export const docRead = defineTool({
  name: "doc.read",
  description: "Read the author's post: its outline, or one section by heading.",
  risk: "read",
  args: z.object({ heading: z.string().trim().max(200).optional() }),
  example: '{"heading":"…"} or {}',
  async run(ctx, args) {
    const doc = ctx.document;
    if (!doc) return { ok: false, observation: "This run has no post." };
    if (!args.heading) {
      const outline = doc.outline.map((s, i) => `${i + 1}. ${s.heading || "(untitled section)"} — ${s.text.split(/\s+/).length} words`).join("\n");
      return { ok: true, progress: true, observation: fence("document", `Title: ${doc.title}\n${outline || doc.text.slice(0, 2000)}`, 4000) };
    }
    const section = doc.outline.find((s) => s.heading.toLowerCase().includes(args.heading!.toLowerCase()));
    if (!section) return { ok: false, observation: `No section matches "${args.heading}". Headings: ${doc.outline.map((s) => s.heading).filter(Boolean).join("; ")}` };
    return { ok: true, progress: true, observation: fence("document", `## ${section.heading}\n${section.text}`, 8000) };
  },
});

export const sourcesList = defineTool({
  name: "sources.list",
  description: "List the sources you have so far, with which ones you've read in full.",
  risk: "read",
  args: z.object({}).passthrough(),
  example: "{}",
  async run(_ctx, _args, state) {
    return { ok: true, observation: state.sources.length ? state.sources.map(sourceLine).join("\n") : "No sources yet." };
  },
});

const findingSchema = z.object({
  statement: z.string().trim().min(1).max(800),
  sources: z.array(z.string()).max(6).default([]),
  kind: z.enum(["fact", "interpretation"]).default("fact"),
});

export const proposeFindings = defineTool({
  name: "research.propose_findings",
  description:
    "Finish: give the author your findings to choose from. Each finding cites the sources (S1…) that support it; mark your own reading across sources as interpretation. Say where sources disagree and what stays unknown. Only call this once you've checked the evidence.",
  risk: "ask",
  args: z.object({
    summary: z.string().trim().min(1).max(1500),
    findings: z.array(findingSchema).min(1).max(12),
    disagreements: z.array(z.string().trim().min(1).max(600)).max(6).default([]),
    openQuestions: z.array(z.string().trim().min(1).max(400)).max(6).default([]),
  }),
  example: '{"summary":"…","findings":[{"statement":"…","sources":["S1"],"kind":"fact"}],"disagreements":[],"openQuestions":[]}',
  async run(ctx, args, state) {
    if (state.sources.length === 0) return { ok: false, observation: "You have no sources yet: search before proposing findings." };
    const sources: StoredSource[] = state.sources.map((s) => ({ id: s.id, ref: s.ref, url: s.url, title: s.title, publisher: s.publisher, excerpt: s.excerpt, publishedDate: s.publishedDate, query: s.query }));
    const findings = resolveCitations(args.findings, sources);
    const unsupported = findings.filter((f) => f.unsupported).length;
    if (unsupported) await ctx.log(`${unsupported} finding(s) cited no retrieved source and are flagged`);
    const proposal = { question: String(ctx.input.question ?? state.goal), summary: args.summary, findings, disagreements: args.disagreements, openQuestions: args.openQuestions, sources };
    // Same shape and key as the scripted Research workflow, so results, metrics and the eval match
    (state as AgentState & { synthesize?: unknown }).synthesize = proposal;
    return { ok: true, observation: "Findings proposed to the author.", approval: { kind: "findings", title: "Choose findings to add to your post", proposal, final: true } };
  },
});

export const finishTool = defineTool({
  name: "finish",
  description: "End without findings, saying why (for example, nothing reliable was found). Prefer proposing findings when you have any.",
  risk: "ask",
  args: z.object({ summary: z.string().trim().min(1).max(1500) }),
  example: '{"summary":"…"}',
  async run(_ctx, args, state) {
    return { ok: true, observation: "Finished.", finished: { summary: args.summary, findings: [], sources: state.sources.map(({ pageText: _p, ...s }) => s), html: "" } };
  },
});

export const RESEARCH_TOOLS: ToolDef[] = [webSearch, webFetch, docRead, sourcesList, proposeFindings, finishTool];
