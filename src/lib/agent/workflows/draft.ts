import { z } from "zod";
import { sanitizePostHtml } from "@/lib/content/sanitize";
import type { WorkflowDef } from "../types";
import { documentBlock, escapeHtml, fence, requireDocument, styleBlock, WORKFLOW_SYSTEM } from "./shared";

// WF-002: Outline → Draft. Plan sections from the document's outline, write
// them in the author's style, review the structure; the author decides
// whether and how to insert it.

const planSchema = z.object({
  sections: z
    .array(
      z.object({
        heading: z.string().min(1).max(160),
        intent: z.string().max(400),
        keyPoints: z.array(z.string().min(1).max(400)).max(8),
      })
    )
    .min(1)
    .max(10),
});

const writeSchema = z.object({
  sections: z.array(z.object({ heading: z.string().min(1).max(160), html: z.string().min(1).max(20_000) })).min(1).max(10),
});

const reviewSchema = z.object({
  summary: z.string().max(1200),
  issues: z.array(z.string().min(1).max(400)).max(8),
});

const LENGTH_WORDS = { short: 500, medium: 1000, long: 1800 } as const;

export const draftWorkflow: WorkflowDef = {
  id: "draft",
  label: "Outline → draft",
  description: "Turn the outline and notes in this post into a full draft in its writing style.",
  tools: [],
  needsDocument: true,
  inputSchema: z.object({
    audience: z.string().trim().max(200).optional(),
    tone: z.string().trim().max(200).optional(),
    length: z.enum(["short", "medium", "long"]).default("medium"),
    styleId: z.string().uuid().optional(),
  }),
  steps: [
    {
      id: "plan",
      label: "Planning sections",
      async run(ctx) {
        const doc = requireDocument(ctx);
        if (!doc.text.trim()) throw new Error("This post is empty. Add an outline or some notes first.");
        const data = await ctx.json({
          label: "Plan sections from the outline",
          tier: "fast",
          system: WORKFLOW_SYSTEM,
          user: [
            "Task id: draft_plan",
            "The document holds the author's outline and notes. Plan the sections of the finished piece: keep the author's headings and order where they exist, and say what each section should achieve.",
            documentBlock(doc),
            'Reply as JSON: {"sections":[{"heading":"","intent":"","keyPoints":[""]}]}',
          ].join("\n\n"),
          schema: planSchema,
          maxOutputTokens: 1500,
        });
        return { output: data };
      },
    },
    {
      id: "write",
      label: "Writing the draft",
      async run(ctx) {
        const doc = requireDocument(ctx);
        const plan = ctx.state.plan as z.infer<typeof planSchema>;
        const length = (ctx.input.length as keyof typeof LENGTH_WORDS) ?? "medium";
        const data = await ctx.json({
          label: "Write sections",
          tier: "quality",
          system: WORKFLOW_SYSTEM,
          user: [
            "Task id: draft_write",
            `Write the full piece from this plan, about ${LENGTH_WORDS[length]} words in total. Use the author's notes; don't add facts, numbers or quotes that aren't in them. Where a fact or example is needed but missing, write a placeholder like [add: example of …].`,
            ctx.input.audience ? `Audience: ${String(ctx.input.audience)}` : "",
            ctx.input.tone ? `Tone: ${String(ctx.input.tone)}` : "",
            styleBlock(ctx),
            fence("outline", JSON.stringify(plan.sections, null, 1), 12_000),
            documentBlock(doc, 16_000),
            'Each section\'s "html" uses only p, strong, em, ul, ol, li, blockquote and h3 tags (no h2: the heading is separate). Reply as JSON: {"sections":[{"heading":"","html":""}]}',
          ]
            .filter(Boolean)
            .join("\n\n"),
          schema: writeSchema,
          maxOutputTokens: Math.round(LENGTH_WORDS[length] * 2.2) + 800,
        });
        const html = data.sections
          .map((s) => `<h2>${escapeHtml(s.heading)}</h2>${sanitizePostHtml(s.html.replace(/<\/?h[12][^>]*>/gi, ""))}`)
          .join("");
        return { output: { sections: data.sections, html } };
      },
    },
    {
      id: "review",
      label: "Checking the structure",
      async run(ctx) {
        const written = ctx.state.write as { html: string };
        const text = written.html.replace(/<[^>]+>/g, " ");
        const data = await ctx.json({
          label: "Structural review of the draft",
          tier: "fast",
          system: WORKFLOW_SYSTEM,
          user: [
            "Task id: draft_review",
            "Briefly review this draft's structure: does it flow, does each section earn its place, is anything missing or repeated? Don't rewrite it.",
            fence("document", text, 20_000),
            'Reply as JSON: {"summary":"","issues":[""]}',
          ].join("\n\n"),
          schema: reviewSchema,
          maxOutputTokens: 700,
        });
        return {
          output: data,
          approval: {
            kind: "draft",
            title: "Review the draft before it goes into your post",
            proposal: { html: written.html, review: data },
          },
        };
      },
    },
  ],
  result(state, approvals) {
    const written = state.write as { html: string } | undefined;
    const mode = approvals.draft?.mode === "replace" ? "replace" : "append";
    return written ? { html: written.html, mode } : {};
  },
};
