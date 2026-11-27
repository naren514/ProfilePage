import { createHash } from "crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { writingIdeas } from "@/lib/db/schema";
import { relevantSamples } from "@/lib/writing/memory/samples";
import { cleanTags } from "@/lib/topics";
import { formatStyle } from "@/lib/writing/ai/prompts";
import { fence } from "../workflows/shared";
import { readingClusters, type ClusterArticle } from "@/lib/reading/clusters";
import { readingLibrary } from "@/lib/reading/related";
import type { IdeaSource } from "@/lib/db/schema";
import { defineTool } from "./registry";

// Memory and ideas tools (agent PRD A3, TL-008 and ideas.create).

export const memorySearch = defineTool({
  name: "memory.search",
  description: "Look up the author's writing memory: their style rules and the writing samples most relevant to a phrase. Use it to see how the author already writes or thinks about something.",
  risk: "read",
  args: z.object({ query: z.string().trim().min(2).max(200) }),
  example: '{"query":"…"}',
  async run(ctx, args) {
    const samples = await relevantSamples({ styleId: (ctx.input.styleId as string | undefined) ?? null, text: args.query, limit: 3 });
    const parts = [
      ctx.style ? formatStyle(ctx.style) : "No writing style is set.",
      samples.length ? samples.map((s) => `## ${s.title}\n${s.text.slice(0, 1200)}`).join("\n\n") : "No writing samples match.",
    ];
    return { ok: true, progress: samples.length > 0, observation: fence("document", parts.join("\n\n"), 6000) };
  },
});

export const ideasCreate = defineTool({
  name: "ideas.create",
  description: "Save a post idea to the author's private Ideas inbox (when something you found would make a good post). One or two sentences, in plain words. If it grew from the author's reading, list those articles' keys in sources (from reading.clusters).",
  risk: "write-private",
  args: z.object({ text: z.string().trim().min(10).max(1000), tags: z.array(z.string().trim().min(1).max(40)).max(5).default([]), sources: z.array(z.string().regex(/^(reading|candidate):[0-9a-f-]{36}$/)).max(8).default([]) }),
  example: '{"text":"…","tags":["…"],"sources":["reading:…"]}',
  async run(ctx, args, state) {
    // The articles it came from (only ones the author really has)
    const known = new Map<string, ClusterArticle>(((state as { clusterArticles?: ClusterArticle[] }).clusterArticles ?? []).map((a) => [a.key, a]));
    const missing = args.sources.filter((k) => !known.has(k));
    if (missing.length) for (const r of await readingLibrary()) if (missing.includes(r.key)) known.set(r.key, { key: r.key, url: r.url, title: r.title, publisher: r.publisher, note: "" });
    const sources: IdeaSource[] = args.sources.flatMap((k) => (known.has(k) ? [{ key: k, url: known.get(k)!.url, title: known.get(k)!.title, publisher: known.get(k)!.publisher }] : []));
    // Ideas from the author's reading must rest on a theme, not a single article
    if ((state as { clusterArticles?: unknown[] }).clusterArticles && sources.length < 2) {
      return { ok: false, progress: true, observation: "An idea from the author's reading needs at least two of the articles it grew from: list two or more keys from one group in sources." };
    }
    // The same idea from the same run is saved once
    const sourceRef = `run:${ctx.run.id}:${createHash("sha256").update(args.text.toLowerCase()).digest("hex").slice(0, 12)}`;
    const [idea] = await db
      .insert(writingIdeas)
      .values({ content: args.text, tags: cleanTags(args.tags), sourceRef, sources })
      .onConflictDoNothing()
      .returning({ id: writingIdeas.id });
    await ctx.log(idea ? `Saved an idea to the Ideas inbox${sources.length ? ` (from ${sources.length} article${sources.length === 1 ? "" : "s"} you read)` : ""}` : "That idea was already saved", { tool: "ideas.create" });
    if (idea) {
      const st = state as { ideasCreated?: number; ideasFiled?: Array<{ text: string; sources: string[] }> };
      st.ideasCreated = (st.ideasCreated ?? 0) + 1;
      st.ideasFiled = [...(st.ideasFiled ?? []), { text: args.text, sources: sources.map((x) => x.key) }];
    }
    return { ok: true, progress: Boolean(idea), observation: idea ? "Saved to the author's Ideas inbox." : "Already saved." };
  },
});

export const readingClustersTool = defineTool({
  name: "reading.clusters",
  description: "Groups of related articles the author kept in the last 30 days (saved, published or picked), with their notes, leaving out themes an existing idea or post already covers. Each article has a key to cite in ideas.create.",
  risk: "read",
  args: z.object({ limit: z.number().int().min(1).max(8).default(6) }),
  example: '{"limit":6}',
  async run(ctx, args, state) {
    if ((state as { clusterArticles?: unknown[] }).clusterArticles) {
      return { ok: true, observation: "You already have the groups above. Next: file ideas with ideas.create, or finish if there were no groups." };
    }
    const clusters = await readingClusters(args.limit);
    (state as { clusterArticles?: ClusterArticle[] }).clusterArticles = clusters.flatMap((c) => c.articles);
    await ctx.log(`Found ${clusters.length} group(s) of related reading`, { tool: "reading.clusters", groups: clusters.length });
    if (!clusters.length) return { ok: true, observation: "No groups of related reading yet (the author needs at least two kept articles on a theme that isn't already an idea or post). Call finish now and say so; don't look again." };
    const text = clusters
      .map((c, i) => `## Group ${i + 1} (shares: ${c.label.join(", ") || "—"})\n${c.articles.map((a) => `- [${a.key}] ${a.title} (${a.publisher})${a.note ? `: ${a.note.slice(0, 300)}` : ""}`).join("\n")}`)
      .join("\n\n");
    return { ok: true, progress: true, observation: fence("reading", text, 9000) };
  },
});
