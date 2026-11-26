import { createHash } from "crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { writingSources } from "@/lib/db/schema";
import type { WorkflowDef } from "../types";
import { authorNotes, escapeHtml, fence, WORKFLOW_SYSTEM } from "./shared";

// WF-003: Research. Plan queries, search the web (Tavily), store what was
// actually retrieved, then synthesize findings that cite only those sources.

const planSchema = z.object({ queries: z.array(z.string().trim().min(2).max(300)).min(1).max(3) });

const synthesisSchema = z.object({
  summary: z.string().max(1500),
  findings: z
    .array(
      z.object({
        statement: z.string().min(1).max(800),
        sources: z.array(z.string()).max(6),
        kind: z.enum(["fact", "interpretation"]).default("fact"),
      })
    )
    .max(12),
  disagreements: z.array(z.string().min(1).max(600)).max(6).default([]),
  openQuestions: z.array(z.string().min(1).max(400)).max(6).default([]),
});

export interface StoredSource {
  id: string;
  ref: string;
  url: string;
  title: string;
  publisher: string;
  excerpt: string;
  publishedDate: string | null;
  query: string;
}

export interface Finding {
  statement: string;
  kind: "fact" | "interpretation";
  sourceIds: string[];
  /** True when none of the cited sources were actually retrieved. */
  unsupported: boolean;
}

function publisherOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Map the model's source references (S1, S2…) to stored sources; flag findings with none. */
export function resolveCitations(
  findings: z.infer<typeof synthesisSchema>["findings"],
  sources: StoredSource[]
): Finding[] {
  const byRef = new Map(sources.map((s) => [s.ref.toUpperCase(), s.id]));
  return findings.map((f) => {
    const ids = Array.from(new Set(f.sources.map((r) => byRef.get(r.trim().toUpperCase())).filter((x): x is string => Boolean(x))));
    return { statement: f.statement, kind: f.kind, sourceIds: ids, unsupported: f.kind === "fact" && ids.length === 0 };
  });
}

/** Research notes as editor HTML, with links to the sources each finding cites. */
export function findingsToHtml(question: string, findings: Finding[], sources: StoredSource[]): string {
  const byId = new Map(sources.map((s) => [s.id, s]));
  const items = findings
    .map((f) => {
      const links = f.sourceIds
        .map((id) => byId.get(id))
        .filter((s): s is StoredSource => Boolean(s))
        .map((s) => `<a href="${escapeHtml(s.url)}">${escapeHtml(s.publisher || s.title || "source")}</a>`)
        .join(", ");
      const tag = f.unsupported ? " <em>[needs a source]</em>" : f.kind === "interpretation" ? " <em>[interpretation]</em>" : "";
      return `<li><p>${escapeHtml(f.statement)}${tag}${links ? ` (${links})` : ""}</p></li>`;
    })
    .join("");
  return `<h2>Research notes: ${escapeHtml(question)}</h2><ul>${items}</ul>`;
}

export const researchWorkflow: WorkflowDef = {
  id: "research",
  label: "Research",
  description: "Search the web for a question or claim and summarize what reliable sources say, with links.",
  tools: ["web.search"],
  needsDocument: true,
  inputSchema: z.object({ question: z.string().trim().min(3, "What should be researched?").max(1000) }),
  steps: [
    {
      id: "plan",
      label: "Planning searches",
      async run(ctx) {
        const data = await ctx.json({
          label: "Plan search queries",
          tier: "fast",
          system: WORKFLOW_SYSTEM,
          user: [
            "Task id: research_plan",
            "Write one to three web search queries that would find reliable, varied sources for this question, including ones that might disagree.",
            fence("question", String(ctx.input.question), 1000),
            authorNotes(ctx),
            ctx.document?.title ? `It's for a post titled: ${ctx.document.title}` : "",
            'Reply as JSON: {"queries":[""]}',
          ]
            .filter(Boolean)
            .join("\n\n"),
          schema: planSchema,
          maxOutputTokens: 300,
        });
        return { output: data };
      },
    },
    {
      id: "search",
      label: "Searching the web",
      async run(ctx) {
        const { queries } = ctx.state.plan as z.infer<typeof planSchema>;
        const seen = new Set<string>();
        const sources: StoredSource[] = [];
        for (const query of queries) {
          const results = await ctx.search(query);
          for (const r of results) {
            if (seen.has(r.url) || sources.length >= 12) continue;
            seen.add(r.url);
            const contentHash = createHash("sha256").update(r.content).digest("hex");
            // A retried step mustn't store the same source twice
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
                  .values({
                    documentId: ctx.run.documentId,
                    runId: ctx.run.id,
                    url: r.url,
                    title: r.title,
                    publisher: publisherOf(r.url),
                    publishedDate: r.publishedDate,
                    excerpt: r.content,
                    contentHash,
                    query,
                  })
                  .returning({ id: writingSources.id })
              )[0].id;
            sources.push({
              id,
              ref: `S${sources.length + 1}`,
              url: r.url,
              title: r.title,
              publisher: publisherOf(r.url),
              excerpt: r.content.slice(0, 1200),
              publishedDate: r.publishedDate,
              query,
            });
          }
        }
        if (sources.length === 0) throw new Error("The searches found no sources. Try rephrasing the question.");
        await ctx.log(`Found ${sources.length} sources`);
        return { output: { sources } };
      },
    },
    {
      id: "synthesize",
      label: "Summarizing what the sources say",
      async run(ctx) {
        const { sources } = ctx.state.search as { sources: StoredSource[] };
        const sourceText = sources
          .map((s) => `[${s.ref}] ${s.title} (${s.publisher}${s.publishedDate ? `, ${s.publishedDate}` : ""})\n${s.excerpt}`)
          .join("\n\n");
        const data = await ctx.json({
          label: "Synthesize findings with citations",
          tier: "quality",
          system: WORKFLOW_SYSTEM,
          user: [
            "Task id: research_synthesize",
            "Using only the sources below, answer the question. Each finding cites the sources that support it by their reference (S1, S2…). Mark a finding as \"interpretation\" when it's your reading across sources rather than something a source states. Note where sources disagree and what remains uncertain. If the sources don't answer something, say so instead of filling the gap.",
            fence("question", String(ctx.input.question), 1000),
            authorNotes(ctx),
            fence("sources", sourceText, 30_000),
            'Reply as JSON: {"summary":"","findings":[{"statement":"","sources":["S1"],"kind":"fact"}],"disagreements":[""],"openQuestions":[""]}',
          ].join("\n\n"),
          schema: synthesisSchema,
          maxOutputTokens: 2200,
        });
        const findings = resolveCitations(data.findings, sources);
        const unsupported = findings.filter((f) => f.unsupported).length;
        if (unsupported) await ctx.log(`${unsupported} finding(s) cited no retrieved source and are flagged`);
        const proposal = { question: ctx.input.question, summary: data.summary, findings, disagreements: data.disagreements, openQuestions: data.openQuestions, sources };
        return { output: proposal, approval: { kind: "findings", title: "Choose findings to add to your post", proposal } };
      },
    },
  ],
  result(state, approvals) {
    const synth = state.synthesize as
      | { question: string; findings: Finding[]; sources: StoredSource[]; summary: string }
      | undefined;
    if (!synth) return {};
    const selected = Array.isArray(approvals.findings?.selected)
      ? (approvals.findings!.selected as number[]).filter((i) => Number.isInteger(i) && synth.findings[i])
      : synth.findings.map((_, i) => i);
    const chosen = selected.map((i) => synth.findings[i]);
    return {
      summary: synth.summary,
      findings: chosen,
      sources: synth.sources,
      html: chosen.length ? findingsToHtml(String(synth.question), chosen, synth.sources) : "",
    };
  },
};
