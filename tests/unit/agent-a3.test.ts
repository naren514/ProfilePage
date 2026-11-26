import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

// The reading tools read the shortlist and the author's settings; keep the database out
const pool = {
  candidates: [
    { id: "c1", url: "https://a.example/one", title: "One", publisher: "a.example", topic: "Finance", score: "8.4", reason: "Deep", urlNormalized: "a.example/one" },
    { id: "c2", url: "https://b.example/two", title: "Two", publisher: "b.example", topic: "Leadership", score: "7.1", reason: "Solid", urlNormalized: "b.example/two" },
  ],
  saved: [{ id: "r1", title: "Mine", url: "https://c.example/mine", publisher: "c.example", note: null, tags: ["Engineering"], status: "inbox" }],
};
vi.mock("@/lib/db", () => ({ db: { insert: () => ({ values: async () => undefined }) } }));
vi.mock("@/lib/reading/shortlist", async (orig) => {
  const real = await orig<typeof import("@/lib/reading/shortlist")>();
  return { ...real, activeCandidates: async () => pool.candidates, savedThisWeek: async () => pool.saved, addCandidate: vi.fn() };
});
vi.mock("@/lib/reading/agent-config", async (orig) => {
  const real = await orig<typeof import("@/lib/reading/agent-config")>();
  return { ...real, getReadingAgentConfig: async () => real.defaultReadingAgentConfig() };
});

import { isoWeek, listWeekFor, overallScore, weekLabel, weekRange } from "@/lib/reading/shortlist";
import { readingAgentConfigSchema, siteMatches, defaultReadingAgentConfig } from "@/lib/reading/agent-config";
import { criticReview, proposeReadingList, readingCandidatesTool, MAX_REVIEWS, SCOUT_TOOLS, WEEKLY_TOOLS, shortlistAdd } from "@/lib/agent/tools/reading-tools";
import { approvedList } from "@/lib/agent/workflows/reading-list";
import { emptyAgentState, toolsFor, type AgentState } from "@/lib/agent/tools/registry";
import { defaultRunBudget, EMPTY_USAGE } from "@/lib/agent/budget";
import type { StepContext } from "@/lib/agent/types";

function ctx(criticReplies: unknown[] = []): StepContext {
  const queue = [...criticReplies];
  return {
    run: { id: "run-1", autonomyLevel: "L1", budget: defaultRunBudget(0.5), documentId: null, createdAt: new Date("2026-11-30T09:45:00Z") },
    input: { week: "2026-W48" },
    state: {},
    approvals: {},
    document: null,
    style: null,
    examples: [],
    signal: new AbortController().signal,
    json: async ({ schema }: { schema: z.ZodTypeAny }) => schema.parse(queue.shift()),
    search: async () => [],
    fetchPage: async () => ({ url: "", title: "", text: "" }),
    activeMs: () => 0,
    usage: () => EMPTY_USAGE,
    log: async () => {},
  } as unknown as StepContext;
}

const draft = (line = "A clear, specific reason this is worth reading.") => ({ title: "Week 48", intro: "Three pieces on money and teams.", picks: [{ ref: "C1", line }, { ref: "R1", line }] });

describe("weekly list: dates and scores", () => {
  it("names ISO weeks the standard way", () => {
    expect(isoWeek(new Date("2026-11-25T12:00:00Z"))).toBe("2026-W48");
    expect(isoWeek(new Date("2027-01-01T12:00:00Z"))).toBe("2026-W53");
    expect(isoWeek(new Date("2026-01-01T12:00:00Z"))).toBe("2026-W01");
  });

  it("a list made early Monday covers the week that just ended", () => {
    expect(listWeekFor(new Date("2026-11-30T09:45:00Z"))).toBe("2026-W48");
  });

  it("turns a week into dates", () => {
    const r = weekRange("2026-W48")!;
    expect(r.start.toISOString().slice(0, 10)).toBe("2026-11-23");
    expect(r.end.toISOString().slice(0, 10)).toBe("2026-11-29");
    expect(weekLabel("2026-W48")).toBe("Nov 23 – 29, 2026");
    expect(weekRange("nope")).toBeNull();
  });

  it("weights relevance double and clamps scores", () => {
    expect(overallScore({ relevance: 10, depth: 10, credibility: 10, recency: 10 })).toBe(10);
    expect(overallScore({ relevance: 0, depth: 10, credibility: 10, recency: 10 })).toBe(6);
    expect(overallScore({ relevance: 99, depth: -5, credibility: 5, recency: 5 })).toBe(6);
  });
});

describe("weekly list: settings", () => {
  it("starts with the author's five topics", () => {
    expect(defaultReadingAgentConfig().topics).toEqual(["Investments", "Finance", "Engineering", "Technology", "Leadership"]);
  });

  it("cleans site addresses and rejects junk", () => {
    const parsed = readingAgentConfigSchema.parse({ ...defaultReadingAgentConfig(), favourSites: ["https://www.HBR.org/topic/x"], avoidSites: ["medium.com"] });
    expect(parsed.favourSites).toEqual(["hbr.org"]);
    expect(readingAgentConfigSchema.safeParse({ ...defaultReadingAgentConfig(), avoidSites: ["not a site"] }).success).toBe(false);
    expect(readingAgentConfigSchema.safeParse({ ...defaultReadingAgentConfig(), topics: [] }).success).toBe(false);
  });

  it("matches a site and its subdomains, not look-alikes", () => {
    expect(siteMatches("https://blog.medium.com/x", ["medium.com"])).toBe(true);
    expect(siteMatches("https://www.medium.com/x", ["medium.com"])).toBe(true);
    expect(siteMatches("https://notmedium.com/x", ["medium.com"])).toBe(false);
  });
});

describe("weekly list: tools and autonomy", () => {
  it("no reading tool can publish; only the runner does, after approval", () => {
    expect([...SCOUT_TOOLS, ...WEEKLY_TOOLS].every((t) => t.risk !== "write-public")).toBe(true);
  });

  it("at L0 the nightly search can't change the shortlist", () => {
    expect(toolsFor("L0", SCOUT_TOOLS).map((t) => t.name)).not.toContain("shortlist.add");
  });

  it("shortlists only pages a search returned, by reference", () => {
    expect(shortlistAdd.args.safeParse({ items: [{ source: "https://evil.example", topic: "Finance", relevance: 9, depth: 9, credibility: 9, recency: 9, reason: "Looks great to me" }] }).success).toBe(false);
  });
});

describe("weekly list: the review gate", () => {
  let state: AgentState;
  beforeEach(async () => {
    state = emptyAgentState("Build the list");
    await readingCandidatesTool.run(ctx(), {}, state);
  });

  it("loads the shortlist and the author's saves as C… and R…", () => {
    const refs = (state as AgentState & { pool: Array<{ ref: string }> }).pool.map((p) => p.ref);
    expect(refs).toEqual(["C1", "C2", "R1"]);
  });

  it("can't propose a list that wasn't reviewed", async () => {
    const out = await proposeReadingList.run(ctx(), draft(), state);
    expect(out.ok).toBe(false);
    expect(out.observation).toMatch(/critic\.review/);
    expect(out.approval).toBeUndefined();
  });

  it("proposes the reviewed draft for approval (final)", async () => {
    await criticReview.run(ctx([{ verdict: "ready", issues: [] }]), draft(), state);
    const out = await proposeReadingList.run(ctx(), draft(), state);
    expect(out.approval).toMatchObject({ kind: "reading_list_approval", final: true });
    const proposal = out.approval!.proposal as { week: string; picks: Array<{ candidateId: string | null; readingItemId: string | null }> };
    expect(proposal.week).toBe("2026-W48");
    expect(proposal.picks.map((p) => p.candidateId ?? p.readingItemId)).toEqual(["c1", "r1"]);
  });

  it("a draft revised after its review is checked again before it reaches the author", async () => {
    await criticReview.run(ctx([{ verdict: "revise", issues: ["Lines are vague"] }]), draft(), state);
    const out = await proposeReadingList.run(ctx([{ verdict: "ready", issues: [] }]), draft("A different line, after the review."), state);
    expect(out.approval?.kind).toBe("reading_list_approval");
    expect((out.approval!.proposal as { review: { rounds: number; verdict: string } }).review).toMatchObject({ rounds: 2, verdict: "ready" });
  });

  it("an article the author removed can't come back, and isn't offered again", async () => {
    (state as AgentState & { excluded: string[] }).excluded = ["https://a.example/one/"];
    const out = await criticReview.run(ctx([{ verdict: "ready", issues: [] }]), draft(), state);
    expect(out.ok).toBe(false);
    expect(out.observation).toMatch(/The author removed "One" \(C1\)/);
    const again = await readingCandidatesTool.run(ctx(), {}, state);
    expect(again.observation).not.toContain("[C1]");
    expect(again.observation).toContain("[C2]");
  });

  it("loading the candidates again is harmless", async () => {
    const again = await readingCandidatesTool.run(ctx(), {}, state);
    expect(again.ok).toBe(true);
    expect(again.observation).toMatch(/Already loaded/);
  });

  it(`allows at most ${MAX_REVIEWS} reviews, then accepts the best version`, async () => {
    for (let i = 0; i < MAX_REVIEWS; i++) await criticReview.run(ctx([{ verdict: "revise", issues: ["Still vague"] }]), draft(`Revision number ${i}, more specific now.`), state);
    const extra = await criticReview.run(ctx([{ verdict: "ready", issues: [] }]), draft(), state);
    expect(extra.ok).toBe(false);
    const out = await proposeReadingList.run(ctx(), draft("Final wording after the last review."), state);
    expect(out.approval?.kind).toBe("reading_list_approval");
  });

  it("rejects unknown references and the same article twice", async () => {
    expect((await criticReview.run(ctx(), { ...draft(), picks: [{ ref: "C9", line: "Something about this piece." }] }, state)).observation).toMatch(/Unknown reference/);
    expect((await criticReview.run(ctx(), { ...draft(), picks: [{ ref: "C1", line: "Something about this piece." }, { ref: "c1", line: "Something else again." }] }, state)).observation).toMatch(/twice/);
  });
});

describe("weekly list: what the author approves is what's published", () => {
  const proposal = {
    week: "2026-W48",
    title: "Week 48",
    intro: "Draft intro.",
    picks: [
      { ref: "C1", title: "One", url: "https://a.example/one", publisher: "a.example", topic: "Finance", line: "Line one.", candidateId: "c1", readingItemId: null },
      { ref: "C2", title: "Two", url: "https://b.example/two", publisher: "b.example", topic: "Leadership", line: "Line two.", candidateId: "c2", readingItemId: null },
      { ref: "R1", title: "Mine", url: "https://c.example/mine", publisher: "c.example", topic: "Engineering", line: "Line three.", candidateId: null, readingItemId: "r1" },
    ],
  };

  it("keeps the selected picks, the edited intro and edited lines", () => {
    const list = approvedList(proposal, { selected: [0, 2], intro: "Two sentences. That's all.", lines: { "2": "My own words." } });
    expect(list.intro).toBe("Two sentences. That's all.");
    expect(list.picks.map((p) => p.title)).toEqual(["One", "Mine"]);
    expect(list.picks[1].line).toBe("My own words.");
    expect(list.picks[0]).not.toHaveProperty("ref");
  });

  it("approving without changes publishes the whole proposal", () => {
    expect(approvedList(proposal, {}).picks).toHaveLength(3);
  });
});
