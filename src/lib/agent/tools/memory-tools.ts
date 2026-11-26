import { createHash } from "crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { writingIdeas } from "@/lib/db/schema";
import { relevantSamples } from "@/lib/writing/memory/samples";
import { cleanTags } from "@/lib/topics";
import { formatStyle } from "@/lib/writing/ai/prompts";
import { fence } from "../workflows/shared";
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
  description: "Save a post idea to the author's private Ideas inbox (when something you found would make a good post). One or two sentences, in plain words.",
  risk: "write-private",
  args: z.object({ text: z.string().trim().min(10).max(1000), tags: z.array(z.string().trim().min(1).max(40)).max(5).default([]) }),
  example: '{"text":"…","tags":["…"]}',
  async run(ctx, args) {
    // The same idea from the same run is saved once
    const sourceRef = `run:${ctx.run.id}:${createHash("sha256").update(args.text.toLowerCase()).digest("hex").slice(0, 12)}`;
    const [idea] = await db
      .insert(writingIdeas)
      .values({ content: args.text, tags: cleanTags(args.tags), sourceRef })
      .onConflictDoNothing()
      .returning({ id: writingIdeas.id });
    await ctx.log(idea ? "Saved an idea to the Ideas inbox" : "That idea was already saved", { tool: "ideas.create" });
    return { ok: true, progress: Boolean(idea), observation: idea ? "Saved to the author's Ideas inbox." : "Already saved." };
  },
});
