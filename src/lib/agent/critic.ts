import { z } from "zod";
import { sanitizePostHtml } from "@/lib/content/sanitize";
import type { StepContext } from "./types";
import { authorNotes, escapeHtml, fence, styleBlock, WORKFLOW_SYSTEM } from "./workflows/shared";

// Self-critique (agent PRD AG-004): an editor reads the agent's own draft
// before the author sees it, and the draft is revised at most MAX_REVISIONS
// times. The workflow enforces the loop; the model only reports and rewrites.

export const MAX_REVISIONS = 2;

export const critiqueSchema = z.object({
  verdict: z.enum(["ready", "revise"]),
  summary: z.string().max(800).default(""),
  issues: z
    .array(z.object({ issue: z.string().min(1).max(400), fix: z.string().max(400).default("") }))
    .max(8)
    .default([]),
});
export type Critique = z.infer<typeof critiqueSchema>;

export const sectionsSchema = z.object({
  sections: z.array(z.object({ heading: z.string().min(1).max(160), html: z.string().min(1).max(20_000) })).min(1).max(10),
});
export type Sections = z.infer<typeof sectionsSchema>["sections"];

export function sectionsToHtml(sections: Sections): string {
  return sections.map((s) => `<h2>${escapeHtml(s.heading)}</h2>${sanitizePostHtml(s.html.replace(/<\/?h[12][^>]*>/gi, ""))}`).join("");
}

const plain = (html: string) => html.replace(/<\/h2>/g, "\n").replace(/<[^>]+>/g, " ").replace(/[ \t]+/g, " ");

/** The editor's read of a draft: ready, or the few changes that matter most. */
export async function critiqueDraft(ctx: StepContext, html: string, round: number): Promise<Critique> {
  return ctx.json({
    label: `Self-check of the draft (round ${round})`,
    tier: "quality",
    system: WORKFLOW_SYSTEM,
    user: [
      "Task id: draft_critique",
      "You are the editor checking a draft before the author sees it. Judge it against the author's style and notes: clarity, flow, whether each section earns its place, repetition, vague or padded sentences, words the style says to avoid, and any fact, number or quote that isn't in the author's notes (it must become a placeholder like [add: …]). Say \"ready\" if only small things remain; otherwise list the few changes that matter most, each with a concrete fix. Don't rewrite the draft.",
      styleBlock(ctx),
      authorNotes(ctx),
      fence("document", plain(html), 20_000),
      'Reply as JSON: {"verdict":"ready|revise","summary":"","issues":[{"issue":"","fix":""}]}',
    ]
      .filter(Boolean)
      .join("\n\n"),
    schema: critiqueSchema,
    maxOutputTokens: 1200,
  });
}

/** Rewrite the draft to address the editor's issues (same sections, same facts). */
export async function reviseDraft(ctx: StepContext, sections: Sections, critique: Critique, maxOutputTokens: number): Promise<Sections> {
  const data = await ctx.json({
    label: "Revising the draft",
    tier: "quality",
    system: WORKFLOW_SYSTEM,
    user: [
      "Task id: draft_revise",
      "Revise this draft to fix the editor's issues. Keep the sections, the author's facts and their order; change only what the issues call for. Don't add facts, numbers or quotes that aren't in the draft or the author's notes.",
      styleBlock(ctx),
      authorNotes(ctx),
      fence("notes", critique.issues.map((i) => `- ${i.issue}${i.fix ? ` → ${i.fix}` : ""}`).join("\n"), 4000),
      fence("outline", JSON.stringify(sections, null, 1), 30_000),
      'Each section\'s "html" uses only p, strong, em, ul, ol, li, blockquote and h3 tags. Reply as JSON: {"sections":[{"heading":"","html":""}]}',
    ]
      .filter(Boolean)
      .join("\n\n"),
    schema: sectionsSchema,
    maxOutputTokens,
  });
  return data.sections;
}
