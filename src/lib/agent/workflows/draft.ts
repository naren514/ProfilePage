import { z } from "zod";
import { sanitizePostHtml } from "@/lib/content/sanitize";
import type { StepDef, WorkflowDef } from "../types";
import { critiqueDraft, reviseDraft, sectionsToHtml, type Critique, type Sections } from "../critic";
import { authorNotes, documentBlock, escapeHtml, fence, requireDocument, styleBlock, WORKFLOW_SYSTEM } from "./shared";

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

const LENGTH_WORDS = { short: 500, medium: 1000, long: 1800 } as const;

/** The newest version of the draft: the last revision, or the first write. */
function latestDraft(state: Record<string, unknown>): { html: string; sections: Sections } {
  for (const id of ["revise_2", "revise_1", "write"]) {
    const v = state[id] as { html?: string; sections?: Sections; skipped?: boolean } | undefined;
    if (v && !v.skipped && v.html) return { html: v.html, sections: v.sections ?? [] };
  }
  return { html: "", sections: [] };
}

function critiqueStep(round: 1 | 2): StepDef {
  return {
    id: `critique_${round}`,
    label: round === 1 ? "Checking the draft" : "Checking the revision",
    async run(ctx) {
      // A second check only follows a revision
      if (round === 2 && (ctx.state.revise_1 as { skipped?: boolean } | undefined)?.skipped !== false) return { output: { skipped: true } };
      const critique = await critiqueDraft(ctx, latestDraft(ctx.state).html, round);
      return { output: critique };
    },
  };
}

function reviseStep(round: 1 | 2): StepDef {
  return {
    id: `revise_${round}`,
    label: round === 1 ? "Revising" : "Revising again",
    async run(ctx) {
      const critique = ctx.state[`critique_${round}`] as (Critique & { skipped?: boolean }) | undefined;
      if (!critique || critique.skipped || critique.verdict === "ready" || critique.issues.length === 0) return { output: { skipped: true } };
      const length = (ctx.input.length as keyof typeof LENGTH_WORDS) ?? "medium";
      const sections = await reviseDraft(ctx, latestDraft(ctx.state).sections, critique, Math.round(LENGTH_WORDS[length] * 2.2) + 800);
      await ctx.log(`Revised after the editor's check (${critique.issues.length} issue(s))`);
      return { output: { sections, html: sectionsToHtml(sections), skipped: false } };
    },
  };
}

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
            authorNotes(ctx),
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
            authorNotes(ctx),
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
    // Self-critique (AG-004): an editor checks the draft before the author sees it;
    // at most two revisions. Enforced here, whatever the model says.
    critiqueStep(1),
    reviseStep(1),
    critiqueStep(2),
    reviseStep(2),
    {
      id: "review",
      label: "Final check",
      async run(ctx) {
        const { html, sections } = latestDraft(ctx.state);
        const rounds = [1, 2].map((r) => ctx.state[`critique_${r}`] as (Critique & { skipped?: boolean }) | undefined).filter((c): c is Critique => Boolean(c && !("skipped" in c && c.skipped)));
        const revisions = [1, 2].filter((r) => ctx.state[`revise_${r}`] && !(ctx.state[`revise_${r}`] as { skipped?: boolean }).skipped).length;
        // The last critique saw the draft before its revision; check what the author will get
        const last = revisions === rounds.length && revisions > 0 ? await critiqueDraft(ctx, html, rounds.length + 1) : rounds[rounds.length - 1];
        const review = {
          summary: last?.summary || (last?.verdict === "ready" ? "The editor found nothing major to change." : ""),
          issues: last?.verdict === "ready" ? [] : (last?.issues ?? []).map((i) => (i.fix ? `${i.issue} (${i.fix})` : i.issue)),
          rounds: rounds.length + (last && !rounds.includes(last) ? 1 : 0),
          revisions,
        };
        return {
          output: { html, sections, review },
          approval: {
            kind: "draft",
            title: "Review the draft before it goes into your post",
            proposal: { html, review },
          },
        };
      },
    },
  ],
  result(state, approvals) {
    const mode = approvals.draft?.mode === "replace" ? "replace" : "append";
    const { html } = latestDraft(state);
    return html ? { html, mode } : {};
  },
};
