import { z } from "zod";
import type { WorkflowDef } from "../types";
import { documentBlock, fence, locateQuote, requireDocument, styleBlock, WORKFLOW_SYSTEM } from "./shared";

// WF-004: Editorial review. Findings point at exact passages; the author fixes
// each one (optionally with an AI rewrite) or dismisses it. Critique is kept
// separate from verification: unsupported claims are flagged for research.

export const REVIEW_CATEGORIES = ["clarity", "logic", "structure", "evidence", "repetition", "ambiguity", "tone"] as const;

const reviewSchema = z.object({
  overall: z.string().max(1500),
  strengths: z.array(z.string().min(1).max(300)).max(4).default([]),
  findings: z
    .array(
      z.object({
        category: z.enum(REVIEW_CATEGORIES),
        severity: z.enum(["low", "medium", "high"]).default("medium"),
        quote: z.string().min(1).max(600),
        issue: z.string().min(1).max(600),
        suggestion: z.string().max(600).default(""),
        needsEvidence: z.boolean().default(false),
      })
    )
    .max(15),
});

/** A finding whose quote was found in the document (whitespace-normalized). */
export type ReviewFinding = z.infer<typeof reviewSchema>["findings"][number];

/** Drop findings whose quote can't be found in the document. */
export function anchorFindings(text: string, findings: z.infer<typeof reviewSchema>["findings"]) {
  const located: ReviewFinding[] = [];
  let dropped = 0;
  for (const f of findings) {
    const quote = locateQuote(text, f.quote);
    if (quote) located.push({ ...f, quote });
    else dropped++;
  }
  return { located, dropped };
}

export const reviewWorkflow: WorkflowDef = {
  id: "review",
  label: "Editorial review",
  description: "A critical read: clarity, logic, structure, evidence and repetition, pointing at specific passages.",
  tools: [],
  needsDocument: true,
  inputSchema: z.object({ focus: z.string().trim().max(500).optional() }),
  steps: [
    {
      id: "review",
      label: "Reading critically",
      async run(ctx) {
        const doc = requireDocument(ctx);
        if (doc.text.trim().split(/\s+/).length < 30) throw new Error("There isn't enough text to review yet (at least 30 words).");
        const data = await ctx.json({
          label: "Editorial review",
          tier: "quality",
          system: WORKFLOW_SYSTEM,
          user: [
            "Task id: editorial_review",
            "Review this draft as a demanding but fair editor. Find the most important problems with clarity, logic, structure, evidence, repetition, ambiguity and tone. For each, quote the exact passage (copied word for word from the document, one sentence or phrase), explain the issue and suggest a fix. Set needsEvidence for factual claims that need a source. Also note what works. Don't rewrite the piece.",
            ctx.input.focus ? fence("notes", `Author's focus: ${String(ctx.input.focus)}`, 500) : "",
            styleBlock(ctx),
            documentBlock(doc),
            'Reply as JSON: {"overall":"","strengths":[""],"findings":[{"category":"clarity","severity":"medium","quote":"","issue":"","suggestion":"","needsEvidence":false}]}',
          ]
            .filter(Boolean)
            .join("\n\n"),
          schema: reviewSchema,
          maxOutputTokens: 2500,
        });
        const { located, dropped } = anchorFindings(doc.text, data.findings);
        if (dropped) await ctx.log(`${dropped} finding(s) quoted text that isn't in the post and were dropped`);
        return { output: { overall: data.overall, strengths: data.strengths, findings: located } };
      },
    },
  ],
  result(state) {
    return (state.review as Record<string, unknown>) ?? {};
  },
};
