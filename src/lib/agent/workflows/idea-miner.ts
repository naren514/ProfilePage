import { z } from "zod";
import { agentTurn, type Playbook } from "../loop";
import { ideasCreate, memorySearch, readingClustersTool } from "../tools/memory-tools";
import { defineTool, type ToolDef } from "../tools/registry";
import type { WorkflowDef } from "../types";

// Idea miner (reading → writing): look at what the author has been reading
// and keeping, find the themes they keep coming back to, and file two or
// three post ideas, each with the articles it grew from. Private: ideas go
// to the Ideas column; nothing is published.

const finishIdeas = defineTool({
  name: "finish",
  description: "End the run with a one-paragraph summary: the themes you saw and the ideas you filed (or why none).",
  risk: "ask",
  args: z.object({ summary: z.string().trim().min(1).max(1200) }),
  example: '{"summary":"…"}',
  async run(_ctx, args, state) {
    return { ok: true, observation: "Finished.", finished: { summary: args.summary, ideas: (state as { ideasCreated?: number }).ideasCreated ?? 0 } };
  },
});

export const IDEA_MINER_TOOLS: ToolDef[] = [readingClustersTool, memorySearch, ideasCreate, finishIdeas];

export const IDEA_MINER_PLAYBOOK: Playbook = {
  id: "idea_miner",
  guidance: [
    "Goal of this playbook: turn what the author has been reading into two or three post ideas only they could write.",
    "Start with reading.clusters: groups of related articles the author kept recently, with their own notes. Pick the strongest themes: several articles, and notes showing the author has a view. Use memory.search to see how the author writes about the theme.",
    "For each chosen theme, file one idea with ideas.create: one or two sentences in plain words, phrased as an angle or a question the author could answer from experience (not a summary of the articles). Put the keys of the articles it grew from in sources, and one or two topic tags. At most three ideas; one strong idea beats three weak ones.",
    "Then finish with a short summary. If there are no groups, finish straight away and say so: that's normal early on.",
  ].join("\n\n"),
  suggestedPlan: ["Look at the groups of related reading", "Check how the author writes about the strongest themes", "File two or three ideas, each with its articles", "Finish with a summary"],
  tools: IDEA_MINER_TOOLS,
  maxTurns: 8,
  onStall: (state) => ({ summary: "Stopped early; the ideas filed so far are in the Ideas column.", ideas: (state as { ideasCreated?: number }).ideasCreated ?? 0 }),
};

export const ideaMinerWorkflow: WorkflowDef = {
  id: "idea_miner",
  label: "Ideas from my reading",
  description: "Finds the themes in what you've been reading and files two or three post ideas, each with the articles it came from.",
  tools: [],
  needsDocument: false,
  inputSchema: z.object({ goal: z.string().trim().max(1000).default("Find post ideas in what I've been reading lately.") }),
  steps: [],
  agentTurn: (ctx) => agentTurn(ctx, IDEA_MINER_PLAYBOOK),
  result: (state) => ({ summary: String((state as { summary?: string }).summary ?? ""), ideas: (state as { ideas?: number; ideasCreated?: number }).ideas ?? (state as { ideasCreated?: number }).ideasCreated ?? 0 }),
};
