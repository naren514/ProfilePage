import { z } from "zod";
import type { WeeklyPick } from "@/lib/db/schema";
import { getReadingAgentConfig, type ReadingAgentConfig } from "@/lib/reading/agent-config";
import { listWeekFor, SHORTLIST_MAX } from "@/lib/reading/shortlist";
import { publishWeeklyList } from "@/lib/reading/weekly";
import { agentTurn, type Playbook } from "../loop";
import { SCOUT_TOOLS, WEEKLY_TOOLS, MAX_REVIEWS } from "../tools/reading-tools";
import type { WorkflowDef } from "../types";

// The weekly reading list (agent PRD A3, the flagship scenario).
//
// reading_scout (nightly, private): search the author's topics, read the
// promising pieces, score them with the rubric, keep the shortlist.
// reading_weekly (Monday): turn the shortlist and the author's own saves into
// a list, have it reviewed, and propose it. On approval the runner (never the
// model) publishes it to /reading/weekly/<week> and the reading list.

function topicsBlock(config: ReadingAgentConfig) {
  return [
    `The author's topics: ${config.topics.join(", ")}.`,
    config.favourSites.length ? `Sites the author likes (search them with favoured:true at least once): ${config.favourSites.join(", ")}.` : "",
    config.avoidSites.length ? `Sites the author never wants: ${config.avoidSites.join(", ")} (already filtered out).` : "",
    `How the author judges an article:\n${config.rubric}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export const SCOUT_PLAYBOOK: Playbook = {
  id: "reading_scout",
  guidance: "",
  suggestedPlan: [
    "Check the shortlist to see which topics already have strong picks",
    "Search two or three topics that are thin on the shortlist, with specific queries",
    "Read the most promising pieces in full when the snippet isn't enough to judge depth",
    "Score them with the rubric and add the good ones to the shortlist",
    "Finish with a one-paragraph summary",
  ],
  tools: SCOUT_TOOLS,
  maxTurns: 14,
};

function scoutGuidance(config: ReadingAgentConfig) {
  return [
    `Goal of this playbook: find a few genuinely worth-reading recent articles on the author's topics and keep a private shortlist (at most ${SHORTLIST_MAX}). Quality over quantity: adding nothing is fine on a thin night.`,
    "Budget: about 3 searches and up to 5 full page reads a night. Rotate topics across nights rather than covering every topic every night.",
    "Only shortlist sources your searches returned (by S reference). Score honestly: a press release, listicle or product pitch scores low on depth.",
    topicsBlock(config),
  ].join("\n\n");
}

export const readingScoutWorkflow: WorkflowDef = {
  id: "reading_scout",
  label: "Reading list: nightly search",
  description: "Searches your topics, reads promising pieces, scores them and keeps this week's private shortlist.",
  tools: ["web.search", "web.fetch"],
  needsDocument: false,
  inputSchema: z.object({ goal: z.string().trim().max(2000).default("Search my topics, read the promising pieces, score them with my rubric, and update this week's shortlist.") }),
  steps: [],
  async agentTurn(ctx) {
    const config = await getReadingAgentConfig();
    return agentTurn(ctx, { ...SCOUT_PLAYBOOK, guidance: scoutGuidance(config) });
  },
  result: (state) => ({ summary: String((state as { summary?: string }).summary ?? "") }),
};

export const WEEKLY_PLAYBOOK: Playbook = {
  id: "reading_weekly",
  guidance: "",
  suggestedPlan: [
    "Load the shortlist and this week's saves",
    "Choose the picks and write one line on each",
    "Write a two- or three-sentence intro",
    "Have the draft reviewed and revise if needed",
    "Propose the list to the author",
  ],
  tools: WEEKLY_TOOLS,
  maxTurns: 10,
};

function weeklyGuidance(config: ReadingAgentConfig) {
  return [
    `Goal of this playbook: prepare this week's "worth your time" list for the author to approve: ${config.minPicks}–${config.maxPicks} picks, each with one plain, specific line on why it's worth reading, and a short intro. If fewer than ${config.minPicks} pieces are good enough, propose fewer, or finish and recommend skipping the week.`,
    `Prefer the highest-scoring shortlist pieces and the author's own saves; keep topics varied and never pick the same story twice. Write lines in the author's voice: concrete, no hype.`,
    `Before proposing, review the draft with critic.review (required; at most ${MAX_REVIEWS} reviews). The author approves the list before anything is published.`,
    topicsBlock(config),
  ].join("\n\n");
}

const approvedSchema = z.object({
  selected: z.array(z.number().int().min(0)).optional(),
  title: z.string().trim().max(120).optional(),
  intro: z.string().trim().max(800).optional(),
  lines: z.record(z.string(), z.string().trim().min(1).max(300)).optional(),
});

interface ReadingProposal {
  week: string;
  title: string;
  intro: string;
  picks: Array<WeeklyPick & { ref: string }>;
}

/** The list as the author approved it: their selection, intro and line edits. */
export function approvedList(proposal: ReadingProposal, decision: unknown) {
  const d = approvedSchema.parse(decision ?? {});
  const chosen = (d.selected ?? proposal.picks.map((_, i) => i)).filter((i) => i < proposal.picks.length);
  const picks: WeeklyPick[] = chosen.map((i) => {
    const { ref: _ref, ...p } = proposal.picks[i];
    return { ...p, line: d.lines?.[String(i)] ?? p.line };
  });
  return { week: proposal.week, title: d.title ?? proposal.title, intro: d.intro ?? proposal.intro, picks };
}

export const readingWeeklyWorkflow: WorkflowDef = {
  id: "reading_weekly",
  label: "Reading list: this week's list",
  description: "Builds this week's reading list from the shortlist and your saves, has it reviewed, and asks you to approve it before it's published.",
  tools: [],
  needsDocument: false,
  inputSchema: z.object({
    goal: z.string().trim().max(2000).default("Build this week's reading list from the shortlist and what I saved."),
    week: z.string().regex(/^\d{4}-W\d{2}$/).optional(),
  }),
  steps: [],
  async agentTurn(ctx) {
    if (!ctx.input.week) ctx.input.week = listWeekFor(ctx.run.createdAt);
    const config = await getReadingAgentConfig();
    return agentTurn(ctx, { ...WEEKLY_PLAYBOOK, guidance: weeklyGuidance(config) });
  },
  async onApproved(run, _state, decision) {
    const proposal = (run.pendingApproval?.proposal ?? null) as ReadingProposal | null;
    if (!proposal) throw new Error("There's no list to publish.");
    const list = approvedList(proposal, decision);
    if (list.picks.length === 0) throw new Error("Choose at least one article for the list.");
    const { list: saved, created } = await publishWeeklyList({ ...list, week: list.week || listWeekFor(run.createdAt), runId: run.id });
    return { week: saved.week, title: saved.title, intro: saved.intro, picks: saved.picks, published: true, alreadyPublished: !created };
  },
  // The published list (from onApproved) is the result
  result: () => ({}),
};
