import { and, desc, eq, gt, inArray, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { certifications, writingAgentRuns, writingIdeas } from "@/lib/db/schema";
import { cleanTags } from "@/lib/topics";
import type { WorkflowDef } from "../types";
import { fence, WORKFLOW_SYSTEM } from "./shared";

// A1 gate: the nightly reading-list digest. Reads what was saved to the
// reading list since the last digest, suggests topics (privately), writes a
// short brief and adds the strongest pieces to the ideas inbox. Nothing is
// published, so there's no approval checkpoint.

const MAX_ITEMS = 20;

export interface DigestItem {
  ref: string;
  id: string;
  title: string;
  source: string;
  url: string | null;
  note: string | null;
  excerpt: string | null;
  tags: string[];
}

const briefSchema = z.object({
  brief: z.array(z.string().trim().min(1).max(300)).min(1).max(8),
  items: z
    .array(
      z.object({
        ref: z.string(),
        tags: z.array(z.string()).max(3).default([]),
        strong: z.boolean().default(false),
        why: z.string().max(300).default(""),
      })
    )
    .max(MAX_ITEMS)
    .default([]),
});

/** When the last digest that finished started; the next one reads from there. */
async function lastDigestAt(currentRunId: string): Promise<Date | null> {
  const [row] = await db
    .select({ createdAt: writingAgentRuns.createdAt })
    .from(writingAgentRuns)
    .where(and(eq(writingAgentRuns.workflow, "digest"), eq(writingAgentRuns.status, "COMPLETED"), ne(writingAgentRuns.id, currentRunId)))
    .orderBy(desc(writingAgentRuns.createdAt))
    .limit(1);
  return row?.createdAt ?? null;
}

export const digestWorkflow: WorkflowDef = {
  id: "digest",
  label: "Reading digest",
  description: "Summarize what you saved to your reading list, suggest topics, and add strong pieces to your ideas inbox.",
  tools: [],
  needsDocument: false,
  inputSchema: z.object({
    /** Only these reading items (an event trigger for one saved article). */
    itemIds: z.array(z.string().uuid()).max(MAX_ITEMS).optional(),
    /** Read items saved after this time; default: since the last digest, or the last 24 hours. */
    since: z.string().datetime().optional(),
  }),
  steps: [
    {
      id: "collect",
      label: "Collecting what you saved",
      async run(ctx) {
        const ids = ctx.input.itemIds as string[] | undefined;
        const since = ctx.input.since
          ? new Date(String(ctx.input.since))
          : (await lastDigestAt(ctx.run.id)) ?? new Date(ctx.run.createdAt.getTime() - 86_400_000);
        const rows = await db
          .select()
          .from(certifications)
          .where(ids?.length ? inArray(certifications.id, ids) : and(gt(certifications.savedAt, since), ne(certifications.status, "archived")))
          .orderBy(desc(certifications.savedAt))
          .limit(MAX_ITEMS);
        const items: DigestItem[] = rows.map((r, i) => ({
          ref: `R${i + 1}`,
          id: r.id,
          title: r.articleTitle,
          source: r.siteName || r.source,
          url: r.articleUrl,
          note: r.note,
          excerpt: r.excerpt,
          tags: r.tags ?? [],
        }));
        await ctx.log(items.length ? `${items.length} saved article(s) to read` : `Nothing new saved since ${since.toISOString().slice(0, 16).replace("T", " ")} UTC`);
        return { output: { since: since.toISOString(), items } };
      },
    },
    {
      id: "brief",
      label: "Writing the brief",
      async run(ctx) {
        const { items } = ctx.state.collect as { items: DigestItem[] };
        if (items.length === 0) return { output: { brief: ["Nothing new was saved."], items: [] } };
        const list = items
          .map((i) => [`[${i.ref}] ${i.title} (${i.source})`, i.note ? `My note: ${i.note}` : "", i.excerpt ? `Description: ${i.excerpt}` : "", i.tags.length ? `Topics: ${i.tags.join(", ")}` : ""].filter(Boolean).join("\n"))
          .join("\n\n");
        const data = await ctx.json({
          label: "Brief, topics and strong picks",
          tier: "fast",
          system: WORKFLOW_SYSTEM,
          user: [
            "Task id: reading_digest",
            "These are articles the author saved to their reading list. Write a brief of at most 8 short lines: what they saved and what connects them. For each article give 1–3 topic tags (short, sentence case; keep its existing topics when it has them), and mark it strong only if it's worth turning into one of the author's own posts, with one line saying why. Use only what the details below say.",
            fence("sources", list, 20_000),
            'Reply as JSON: {"brief":[""],"items":[{"ref":"R1","tags":[""],"strong":false,"why":""}]}',
          ].join("\n\n"),
          schema: briefSchema,
          maxOutputTokens: 1200,
        });
        const known = new Set(items.map((i) => i.ref));
        return { output: { brief: data.brief, items: data.items.filter((x) => known.has(x.ref)) } };
      },
    },
    {
      id: "file",
      label: "Filing topics and ideas",
      async run(ctx) {
        const { items } = ctx.state.collect as { items: DigestItem[] };
        const brief = ctx.state.brief as z.infer<typeof briefSchema>;
        const byRef = new Map(items.map((i) => [i.ref, i]));
        let suggested = 0;
        let ideas = 0;
        for (const pick of brief.items) {
          const item = byRef.get(pick.ref);
          if (!item) continue;
          const tags = cleanTags(pick.tags, 3);
          // Topic suggestions stay private until the author applies them
          if (tags.length && item.tags.length === 0) {
            await db.update(certifications).set({ suggestedTags: tags }).where(eq(certifications.id, item.id));
            suggested++;
          }
          if (pick.strong) {
            const inserted = await db
              .insert(writingIdeas)
              .values({
                content: `From my reading: ${item.title}${item.url ? ` (${item.url})` : ""}${pick.why ? `\n\n${pick.why}` : ""}`,
                tags: cleanTags([...item.tags, ...tags], 5),
                sourceRef: `reading:${item.id}`,
              })
              .onConflictDoNothing()
              .returning({ id: writingIdeas.id });
            ideas += inserted.length;
          }
        }
        if (ideas) await ctx.log(`Added ${ideas} idea(s) to your inbox`);
        return { output: { suggestedTopics: suggested, ideasAdded: ideas } };
      },
    },
  ],
  result(state) {
    const collect = state.collect as { since: string; items: DigestItem[] } | undefined;
    const brief = state.brief as z.infer<typeof briefSchema> | undefined;
    const file = state.file as { suggestedTopics: number; ideasAdded: number } | undefined;
    return {
      since: collect?.since,
      articles: collect?.items.length ?? 0,
      brief: brief?.brief ?? [],
      strong: (brief?.items ?? []).filter((i) => i.strong).map((i) => ({ title: collect?.items.find((x) => x.ref === i.ref)?.title, why: i.why })),
      suggestedTopics: file?.suggestedTopics ?? 0,
      ideasAdded: file?.ideasAdded ?? 0,
    };
  },
};
