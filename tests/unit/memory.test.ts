import { describe, expect, it } from "vitest";
import { buildTsQuery } from "@/lib/writing/memory/keywords";
import { applyProposals, MIN_SUPPORT, vetProposals } from "@/lib/agent/workflows/learn";
import { editedTextToHtml, REJECT_REASONS } from "@/components/writing/ai-assist";
import { WORKFLOWS } from "@/lib/agent/workflows";

describe("buildTsQuery", () => {
  it("keeps distinctive words, most frequent first (longer first on ties), joined with OR", () => {
    expect(buildTsQuery("Migration plans fail. The migration plan nobody read; migration again.")).toBe("migration | nobody | plans | fail | plan | read");
  });

  it("drops stopwords, short words, numbers and punctuation (safe for to_tsquery)", () => {
    const q = buildTsQuery("Which of these would have been 2026's & (best) | choice?!");
    expect(q).toBe("choice | best");
    expect(q).not.toMatch(/[&()!?']/);
  });

  it("folds accents and returns null when nothing is left", () => {
    expect(buildTsQuery("Café décor")).toBe("decor | cafe");
    expect(buildTsQuery("a an the of it")).toBeNull();
  });

  it("caps the number of terms", () => {
    const text = Array.from({ length: 40 }, (_, i) => `word${String.fromCharCode(97 + (i % 26))}${i}`).join(" ");
    expect(buildTsQuery(text, 12)!.split(" | ")).toHaveLength(12);
  });
});

describe("learning proposals", () => {
  const rules = { voice: "Warm and honest. First person.", avoid: ["synergy"], structure: "Open with a concrete moment." };
  const evidence = new Set(["e1", "e2", "e3"]);

  it("keeps proposals backed by enough real feedback", () => {
    const { kept, dropped } = vetProposals(
      [
        { field: "avoid", action: "add", text: "basically", rationale: "r", evidence: ["e1", "e2"], conflictsWith: null },
        { field: "sentences", action: "add", text: "Keep sentences short", rationale: "r", evidence: ["e1", "nope", "e1"], conflictsWith: null },
      ],
      rules,
      evidence
    );
    expect(kept.map((k) => k.text)).toEqual(["basically"]);
    expect(dropped[0].why).toContain(`needs ${MIN_SUPPORT}`);
  });

  it("drops duplicates of existing rules and of each other, and removals of rules that don't exist", () => {
    const { kept, dropped } = vetProposals(
      [
        { field: "avoid", action: "add", text: "Synergy", rationale: "r", evidence: ["e1", "e2"], conflictsWith: null },
        { field: "voice", action: "add", text: "first person", rationale: "r", evidence: ["e1", "e2"], conflictsWith: null },
        { field: "other", action: "add", text: "Use British spelling", rationale: "r", evidence: ["e1", "e2"], conflictsWith: null },
        { field: "other", action: "add", text: "use british spelling.", rationale: "r", evidence: ["e2", "e3"], conflictsWith: null },
        { field: "structure", action: "remove", text: "End with a takeaway", rationale: "r", evidence: ["e1", "e3"], conflictsWith: null },
      ],
      rules,
      evidence
    );
    expect(kept.map((k) => k.text)).toEqual(["Use British spelling"]);
    expect(dropped.map((d) => d.why)).toEqual(["already in the style", "already in the style", "duplicate proposal", "not in the style"]);
  });

  it("keeps a conflict flag for the author to see", () => {
    const { kept } = vetProposals(
      [{ field: "voice", action: "add", text: "Use third person", rationale: "r", evidence: ["e1", "e2"], conflictsWith: "First person." }],
      rules,
      evidence
    );
    expect(kept[0].conflictsWith).toBe("First person.");
  });

  it("applies approved changes to the rules", () => {
    const next = applyProposals(rules, [
      { field: "avoid", action: "add", text: "basically", rationale: "", evidenceIds: [], conflictsWith: null },
      { field: "avoid", action: "remove", text: "SYNERGY", rationale: "", evidenceIds: [], conflictsWith: null },
      { field: "voice", action: "add", text: "Admit uncertainty", rationale: "", evidenceIds: [], conflictsWith: null },
      { field: "structure", action: "remove", text: "open with a concrete moment", rationale: "", evidenceIds: [], conflictsWith: null },
      { field: "other", action: "add", text: "Use British spelling.", rationale: "", evidenceIds: [], conflictsWith: null },
    ]);
    expect(next.avoid).toEqual(["basically"]);
    expect(next.voice).toBe("Warm and honest. First person. Admit uncertainty.");
    expect(next.structure).toBe("");
    expect(next.other).toBe("Use British spelling.");
    expect(rules.avoid).toEqual(["synergy"]); // input untouched
  });

  it("is registered with no tools and requires a style", () => {
    expect(WORKFLOWS.learn.tools).toEqual([]);
    expect(WORKFLOWS.learn.inputSchema.safeParse({}).success).toBe(false);
  });
});

describe("edited suggestions", () => {
  it("turns edited text into paragraphs, escaped", () => {
    expect(editedTextToHtml("First <b>line</b>\n\nSecond & last", "blocks")).toBe("<p>First &lt;b&gt;line&lt;/b&gt;</p><p>Second &amp; last</p>");
  });

  it("keeps inline edits inline", () => {
    expect(editedTextToHtml("a  tighter\nphrase ", "inline")).toBe("a  tighter phrase");
  });

  it("offers quick reasons for rejecting", () => {
    expect(REJECT_REASONS.length).toBeGreaterThanOrEqual(4);
  });
});
