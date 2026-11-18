import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { stories, writingDocuments } from "@/lib/db/schema";
import { generateSlug, isValidSlug } from "@/lib/content/slug";
import type { WorkflowDef } from "../types";
import { documentBlock, requireDocument, styleBlock, WORKFLOW_SYSTEM } from "./shared";

// WF-005: Publication prep. Suggest title, excerpt, URL and tags; validate the
// URL; the author picks. Publishing itself stays a separate, explicit click.

const suggestSchema = z.object({
  titles: z.array(z.string().trim().min(1).max(200)).min(1).max(4),
  excerpts: z.array(z.string().trim().min(1).max(400)).min(1).max(3),
  slug: z.string().trim().max(120),
  tags: z.array(z.string().trim().min(1).max(40)).max(6),
});

/** A valid slug not used by another live post (adds -2, -3… if needed). */
export async function availableSlug(base: string, documentId: string): Promise<string> {
  const [doc] = await db.select({ storyId: writingDocuments.storyId }).from(writingDocuments).where(eq(writingDocuments.id, documentId)).limit(1);
  const root = (isValidSlug(base) ? base : generateSlug(base)) || "post";
  for (let n = 1; n < 50; n++) {
    const candidate = n === 1 ? root : `${root}-${n}`.slice(0, 255);
    const conditions = [eq(stories.slug, candidate)];
    if (doc?.storyId) conditions.push(ne(stories.id, doc.storyId));
    const [taken] = await db.select({ id: stories.id }).from(stories).where(and(...conditions)).limit(1);
    if (!taken) return candidate;
  }
  return `${root}-${Date.now()}`;
}

export const publishPrepWorkflow: WorkflowDef = {
  id: "publish_prep",
  label: "Prepare to publish",
  description: "Suggest a title, excerpt, URL and tags. You choose; publishing stays a separate step.",
  tools: [],
  needsDocument: true,
  inputSchema: z.object({}),
  steps: [
    {
      id: "suggest",
      label: "Suggesting title, excerpt and tags",
      async run(ctx) {
        const doc = requireDocument(ctx);
        if (!doc.text.trim()) throw new Error("This post is empty.");
        const data = await ctx.json({
          label: "Suggest publication metadata",
          tier: "fast",
          system: WORKFLOW_SYSTEM,
          user: [
            "Task id: publish_metadata",
            "Suggest metadata for publishing this post: three title options (specific, not clickbait), two excerpts (one or two sentences shown on the post list), a short URL slug (lowercase words joined by hyphens) and up to five tags.",
            doc.title ? `Current title: ${doc.title}` : "",
            styleBlock(ctx),
            documentBlock(doc, 16_000),
            'Reply as JSON: {"titles":[""],"excerpts":[""],"slug":"","tags":[""]}',
          ]
            .filter(Boolean)
            .join("\n\n"),
          schema: suggestSchema,
          maxOutputTokens: 600,
        });
        const slug = await availableSlug(generateSlug(data.slug || data.titles[0]), doc.id);
        const tags = Array.from(new Set(data.tags.map((t) => t.toLowerCase()))).slice(0, 5);
        const proposal = { titles: data.titles, excerpts: data.excerpts, slug, tags };
        return { output: proposal, approval: { kind: "metadata", title: "Choose title, excerpt and tags", proposal } };
      },
    },
  ],
  result(_state, approvals) {
    const m = approvals.metadata ?? {};
    return { title: m.title, excerpt: m.excerpt, slug: m.slug, tags: m.tags };
  },
};
