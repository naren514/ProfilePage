import { z } from "zod";
import type { WorkflowDef } from "../types";
import { escapeHtml, fence, styleBlock, WORKFLOW_SYSTEM } from "./shared";

// WF-001: Idea → Outline. Explore angles, the author picks a direction, then
// outline candidates; the author picks one.

const directionSchema = z.object({
  angles: z.array(z.object({ title: z.string().min(1).max(160), summary: z.string().max(600) })).min(2).max(5),
  theses: z.array(z.string().min(1).max(400)).min(2).max(4),
  audiences: z.array(z.object({ name: z.string().min(1).max(120), why: z.string().max(400) })).min(1).max(4),
  questions: z.array(z.string().min(1).max(300)).max(8),
  counterarguments: z.array(z.string().min(1).max(400)).max(5),
});

export const outlineSchema = z.object({
  title: z.string().min(1).max(200),
  sections: z
    .array(z.object({ heading: z.string().min(1).max(160), points: z.array(z.string().min(1).max(400)).max(8) }))
    .min(2)
    .max(10),
});

const outlinesSchema = z.object({ outlines: z.array(outlineSchema).min(1).max(3) });

export type Outline = z.infer<typeof outlineSchema>;

/** Outline as editor HTML: section headings with bullet points. */
export function outlineToHtml(outline: Outline): string {
  return outline.sections
    .map(
      (s) =>
        `<h2>${escapeHtml(s.heading)}</h2>` +
        (s.points.length ? `<ul>${s.points.map((p) => `<li><p>${escapeHtml(p)}</p></li>`).join("")}</ul>` : "")
    )
    .join("");
}

export const exploreWorkflow: WorkflowDef = {
  id: "explore",
  label: "Idea → outline",
  description: "Explore angles for an idea, choose a direction, then pick an outline.",
  tools: [],
  needsDocument: false,
  inputSchema: z.object({
    idea: z.string().trim().min(3, "Write a sentence or two about the idea").max(8000),
    styleId: z.string().uuid().optional(),
  }),
  steps: [
    {
      id: "explore",
      label: "Exploring angles",
      async run(ctx) {
        const idea = String(ctx.input.idea);
        const data = await ctx.json({
          label: "Explore angles, theses, audiences and questions",
          tier: "quality",
          system: WORKFLOW_SYSTEM,
          user: [
            "Task id: explore_angles",
            "Help the author develop this idea into a piece of writing. Suggest distinct angles, possible theses (one-sentence arguments), likely audiences, open questions worth answering, and the strongest counterarguments.",
            fence("idea", idea, 8000),
            styleBlock(ctx),
            'Reply as JSON: {"angles":[{"title":"","summary":""}],"theses":[""],"audiences":[{"name":"","why":""}],"questions":[""],"counterarguments":[""]}',
          ]
            .filter(Boolean)
            .join("\n\n"),
          schema: directionSchema,
          maxOutputTokens: 1800,
        });
        return {
          output: data,
          approval: { kind: "direction", title: "Choose a direction", proposal: data },
        };
      },
    },
    {
      id: "outline",
      label: "Drafting outline options",
      async run(ctx) {
        const direction = ctx.approvals.direction ?? {};
        const data = await ctx.json({
          label: "Outline candidates",
          tier: "quality",
          system: WORKFLOW_SYSTEM,
          user: [
            "Task id: outline_candidates",
            "Write two different outlines for this piece, following the chosen direction. Each section gets a heading and a few bullet points of what it covers. Points are notes, not finished prose.",
            fence("idea", String(ctx.input.idea), 8000),
            fence(
              "direction",
              [
                direction.angle && `Angle: ${direction.angle}`,
                direction.thesis && `Thesis: ${direction.thesis}`,
                direction.audience && `Audience: ${direction.audience}`,
                direction.notes && `Author's notes: ${direction.notes}`,
              ]
                .filter(Boolean)
                .join("\n"),
              3000
            ),
            styleBlock(ctx),
            'Reply as JSON: {"outlines":[{"title":"","sections":[{"heading":"","points":[""]}]}]}',
          ]
            .filter(Boolean)
            .join("\n\n"),
          schema: outlinesSchema,
          maxOutputTokens: 2500,
        });
        return {
          output: data,
          approval: { kind: "outline", title: "Choose an outline", proposal: data },
        };
      },
    },
  ],
  result(state, approvals) {
    const outlines = (state.outline as z.infer<typeof outlinesSchema> | undefined)?.outlines ?? [];
    const choice = approvals.outline ?? {};
    const index = typeof choice.outlineIndex === "number" ? choice.outlineIndex : 0;
    const outline = outlines[index] ?? outlines[0];
    return outline ? { outline, html: outlineToHtml(outline), title: outline.title } : {};
  },
};
