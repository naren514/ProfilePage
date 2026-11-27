import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import { clusterArticles, dropCovered, type ClusterArticle } from "@/lib/reading/clusters";
import { checkReport, reportToHtml, type DeepReport } from "@/lib/agent/workflows/deep-research";

const a = (key: string, title: string, note = ""): ClusterArticle => ({ key, url: `https://x.example/${key}`, title, publisher: "X", note });

describe("reading clusters", () => {
  const articles = [
    a("r1", "Why legacy data migrations overrun", "Migration planning and data quality"),
    a("r2", "A ten-year migration of legacy systems", "Data migration cut-over lessons"),
    a("r3", "Index funds and long-term returns", "Low fees win for investors"),
    a("r4", "Fees: why index funds beat active funds", "Investors and fees over decades"),
    a("r5", "My weekend sourdough experiments", "Flour and starter"),
  ];

  it("groups related articles and leaves loners out", () => {
    const groups = clusterArticles(articles);
    const keys = groups.map((g) => g.articles.map((x) => x.key).sort());
    expect(keys).toEqual(expect.arrayContaining([["r1", "r2"], ["r3", "r4"]]));
    expect(keys.flat()).not.toContain("r5");
    expect(groups[0].label.length).toBeGreaterThan(0);
  });

  it("drops a theme an idea already uses, or one that reads like an existing title", () => {
    const groups = clusterArticles(articles);
    expect(dropCovered(groups, [], 0.3, new Set(["r1", "r2"])).map((g) => g.articles[0].key)).not.toContain("r1");
    const left = dropCovered(groups, ["Why index funds beat active funds: fees over decades"], 0.3);
    expect(left.some((g) => g.articles.some((x) => x.key === "r3"))).toBe(false);
    expect(left.some((g) => g.articles.some((x) => x.key === "r1"))).toBe(true);
  });
});

describe("deep research report checks", () => {
  const sources = [{ ref: "S1" }, { ref: "S2" }, { ref: "S3" }, { ref: "S4" }, { ref: "S5" }];
  const questions = ["How often do migrations overrun?", "What causes the delays?"];
  const good = {
    title: "Why migrations overrun",
    summary: "Most overrun, mostly because of data quality.",
    sections: [
      { question: "How often do migrations overrun?", findings: [{ text: "Most do.", sources: ["S1", "s2"], confidence: "high" as const }] },
      { question: "What causes the delays?", findings: [{ text: "Data quality.", sources: ["S3", "S4"], confidence: "medium" as const }] },
    ],
    disagreements: [],
    openQuestions: [],
  };

  it("accepts a cited report that covers every sub-question", () => {
    expect(checkReport(good, questions, sources)).toBeNull();
  });
  it("refuses uncited findings and unknown sources", () => {
    expect(checkReport({ ...good, sections: [{ ...good.sections[0], findings: [{ text: "Most do.", sources: [], confidence: "high" }] }, good.sections[1]] }, questions, sources)).toMatch(/cite at least one/);
    expect(checkReport({ ...good, sections: [{ ...good.sections[0], findings: [{ text: "Most do.", sources: ["S9"], confidence: "high" }] }, good.sections[1]] }, questions, sources)).toMatch(/S9/);
  });
  it("refuses a report that skips a sub-question, unless it's listed as open", () => {
    const skipped = { ...good, sections: [good.sections[0]] };
    expect(checkReport(skipped, questions, sources)).toMatch(/causes the delays/);
    expect(checkReport({ ...skipped, openQuestions: ["What causes the delays? Not enough evidence."], sections: [{ ...good.sections[0], findings: [{ text: "Most do.", sources: ["S1", "S2", "S3", "S4"], confidence: "high" as const }] }] }, questions, sources)).toBeNull();
  });
  it("refuses a report resting on too few sources", () => {
    const thin = { ...good, sections: good.sections.map((s) => ({ ...s, findings: [{ ...s.findings[0], sources: ["S1"] }] })) };
    expect(checkReport(thin, questions, sources)).toMatch(/only 1 source/);
  });
  it("renders numbered citations, confidence and the source list, escaped", () => {
    const report: DeepReport = { ...good, question: "Why do <migrations> overrun?", sources: [1, 2, 3, 4].map((n) => ({ ref: `S${n}`, url: `https://s${n}.example/?a=1&b=2`, title: `Source ${n}`, publisher: "P", publishedDate: null })), sections: good.sections.map((s) => ({ ...s, findings: s.findings.map((f) => ({ ...f, sources: f.sources.map((x) => x.toUpperCase()) })) })) };
    const html = reportToHtml(report);
    expect(html).toContain("<h2>Research: Why do &lt;migrations&gt; overrun?</h2>");
    expect(html).toContain("<strong>Well supported:</strong> Most do.");
    expect(html).toContain('href="https://s2.example/?a=1&amp;b=2">[2]</a>');
    expect(html).toContain("<ol><li>");
  });
});

describe("deep research fallback", () => {
  it("turns the agent's notes into a report when it runs out of turns", async () => {
    const { reportFromNotes } = await import("@/lib/agent/workflows/deep-research");
    const ds = {
      goal: "Why do migrations overrun?",
      questions: ["How often?", "Why?", "What helps?"],
      notes: [
        { q: 1, text: "Most overrun.", sources: ["S1"], confidence: "high" as const },
        { q: 2, text: "Data quality.", sources: ["S2", "S3"], confidence: "medium" as const },
      ],
      sources: [1, 2, 3, 4].map((n) => ({ id: `${n}`, ref: `S${n}`, url: `https://s${n}.example`, title: `S${n}`, publisher: "P", excerpt: "", publishedDate: null, query: "q" })),
    } as never;
    const r = reportFromNotes(ds)!;
    expect(r.sections.map((s) => s.question)).toEqual(["How often?", "Why?"]);
    expect(r.openQuestions).toEqual(["What helps?"]);
    expect(r.sources.map((s) => s.ref)).toEqual(["S1", "S2", "S3"]);
    expect(r.review?.verdict).toBe("not reviewed");
  });
});
