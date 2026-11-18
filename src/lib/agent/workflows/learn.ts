import { z } from "zod";
import type { StyleRules } from "@/lib/db/schema";
import { learningEvidence } from "@/lib/writing/memory/feedback";
import { getStyle, updateStyle } from "@/lib/writing/ai/styles";
import type { WorkflowDef } from "../types";
import { fence, normalizeSpace, WORKFLOW_SYSTEM } from "./shared";

// FR-MEM-004: propose style updates from repeated feedback. Nothing changes
// until the author approves; approved changes become a new style version.

export const MIN_EVIDENCE = 5;
export const MIN_SUPPORT = 2;

const FIELDS = ["voice", "sentences", "structure", "avoid", "other"] as const;
type Field = (typeof FIELDS)[number];

const proposalSchema = z.object({
  proposals: z
    .array(
      z.object({
        field: z.enum(FIELDS),
        action: z.enum(["add", "remove"]),
        text: z.string().trim().min(2).max(300),
        rationale: z.string().trim().max(500),
        evidence: z.array(z.string()).max(12),
        conflictsWith: z.string().trim().max(300).optional().nullable(),
      })
    )
    .max(8),
});

export interface Proposal {
  field: Field;
  action: "add" | "remove";
  text: string;
  rationale: string;
  evidenceIds: string[];
  /** An existing rule this one contradicts (flagged for the author). */
  conflictsWith: string | null;
}

const norm = (s: string) => normalizeSpace(s).toLowerCase().replace(/[.;,]+$/, "");

function ruleLines(rules: StyleRules, field: Field): string[] {
  if (field === "avoid") return rules.avoid ?? [];
  const value = rules[field];
  return value ? value.split(/(?<=[.!?])\s+|\n+/).map((l) => l.trim()).filter(Boolean) : [];
}

/**
 * Keep proposals backed by enough real evidence, drop duplicates of existing
 * rules (and of each other), and drop removals of rules that don't exist.
 */
export function vetProposals(
  raw: z.infer<typeof proposalSchema>["proposals"],
  rules: StyleRules,
  evidenceIds: Set<string>
): { kept: Proposal[]; dropped: Array<{ text: string; why: string }> } {
  const kept: Proposal[] = [];
  const dropped: Array<{ text: string; why: string }> = [];
  const seen = new Set<string>();
  for (const p of raw) {
    const ids = Array.from(new Set(p.evidence.filter((id) => evidenceIds.has(id))));
    const key = `${p.field}:${p.action}:${norm(p.text)}`;
    const existing = ruleLines(rules, p.field).map(norm);
    const present = existing.some((line) => line === norm(p.text) || (p.field !== "avoid" && line.includes(norm(p.text))));
    if (ids.length < MIN_SUPPORT) dropped.push({ text: p.text, why: `backed by ${ids.length} piece(s) of feedback; needs ${MIN_SUPPORT}` });
    else if (seen.has(key)) dropped.push({ text: p.text, why: "duplicate proposal" });
    else if (p.action === "add" && present) dropped.push({ text: p.text, why: "already in the style" });
    else if (p.action === "remove" && !present) dropped.push({ text: p.text, why: "not in the style" });
    else {
      seen.add(key);
      kept.push({ field: p.field, action: p.action, text: p.text, rationale: p.rationale, evidenceIds: ids, conflictsWith: p.conflictsWith || null });
    }
  }
  return { kept, dropped };
}

/** Apply approved proposals to a style's rules. */
export function applyProposals(rules: StyleRules, proposals: Proposal[]): StyleRules {
  const next: StyleRules = { ...rules, avoid: [...(rules.avoid ?? [])] };
  for (const p of proposals) {
    if (p.field === "avoid") {
      const list = next.avoid ?? [];
      next.avoid = p.action === "add" ? Array.from(new Set([...list, p.text])) : list.filter((w) => norm(w) !== norm(p.text));
    } else {
      const current = next[p.field] ?? "";
      if (p.action === "add") {
        const sentence = /[.!?]$/.test(p.text) ? p.text : `${p.text}.`;
        next[p.field] = current ? `${current.replace(/\s+$/, "")} ${sentence}` : sentence;
      } else {
        const lines = ruleLines(next, p.field).filter((line) => !norm(line).includes(norm(p.text)));
        next[p.field] = lines.join(" ");
      }
    }
  }
  if (!next.avoid?.length) delete next.avoid;
  return next;
}

function clipText(s: string | null, n: number) {
  if (!s) return "";
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

export const learnWorkflow: WorkflowDef = {
  id: "learn",
  label: "Learn from my feedback",
  description: "Suggest changes to a writing style based on the AI suggestions you accepted, edited and rejected.",
  tools: [],
  needsDocument: false,
  inputSchema: z.object({ styleId: z.string().uuid() }),
  steps: [
    {
      id: "gather",
      label: "Gathering your feedback",
      async run(ctx) {
        const styleId = String(ctx.input.styleId);
        const style = await getStyle(styleId);
        if (!style || style.archived) throw new Error("That style no longer exists.");
        const evidence = await learningEvidence(styleId, 40);
        if (evidence.length < MIN_EVIDENCE) {
          throw new Error(
            `Not enough feedback for "${style.name}" yet: ${evidence.length} of the ${MIN_EVIDENCE} accepted, edited or rejected suggestions needed. Keep using AI edits with this style and try again.`
          );
        }
        await ctx.log(`Using ${evidence.length} pieces of feedback for "${style.name}" (version ${style.version})`);
        return {
          output: {
            styleId,
            styleName: style.name,
            styleVersion: style.version,
            rules: style.rules,
            evidence: evidence.map((e) => ({
              id: e.id,
              status: e.status,
              operation: e.operation,
              reason: e.reason,
              original: clipText(e.original, 500),
              proposal: clipText(e.proposal, 500),
              final: e.status === "modified" ? clipText(e.final, 500) : null,
            })),
          },
        };
      },
    },
    {
      id: "propose",
      label: "Looking for patterns",
      async run(ctx) {
        const gathered = ctx.state.gather as {
          styleId: string;
          styleName: string;
          styleVersion: number;
          rules: StyleRules;
          evidence: Array<{ id: string; status: string; operation: string; reason: string | null; original: string; proposal: string; final: string | null }>;
        };
        const evidenceText = gathered.evidence
          .map((e) =>
            [
              `[${e.id}] ${e.status.toUpperCase()} (${e.operation})${e.reason ? ` reason: ${e.reason}` : ""}`,
              `original: ${e.original}`,
              `AI proposal: ${e.proposal}`,
              e.final ? `author's edited version: ${e.final}` : "",
            ]
              .filter(Boolean)
              .join("\n")
          )
          .join("\n\n");
        const data = await ctx.json({
          label: "Propose style changes from feedback",
          tier: "quality",
          system: WORKFLOW_SYSTEM,
          user: [
            "Task id: learn_preferences",
            `The author has a writing style called "${gathered.styleName}". Below are AI suggestions they accepted, edited or rejected while using it. Find patterns that recur across several of them and propose small, specific changes to the style's rules. Every proposal must cite at least ${MIN_SUPPORT} feedback items by id as evidence. A single rejection is not a pattern. Edits the author made to accepted suggestions are strong evidence of what they prefer. Don't propose anything the current rules already say. If a proposal would contradict a current rule, quote that rule in conflictsWith. Propose nothing if there is no clear pattern.`,
            fence("notes", `Current rules:\n${JSON.stringify(gathered.rules, null, 1)}`, 6000),
            fence("notes", evidenceText, 30_000),
            'Fields: voice, sentences, structure, avoid (single words or phrases), other. Reply as JSON: {"proposals":[{"field":"avoid","action":"add","text":"","rationale":"","evidence":["<id>"],"conflictsWith":null}]}',
          ].join("\n\n"),
          schema: proposalSchema,
          maxOutputTokens: 1500,
        });
        const { kept, dropped } = vetProposals(data.proposals, gathered.rules, new Set(gathered.evidence.map((e) => e.id)));
        if (dropped.length) await ctx.log(`Set aside ${dropped.length} proposal(s): ${dropped.map((d) => `"${d.text}" (${d.why})`).join("; ")}`);
        const proposal = {
          styleId: gathered.styleId,
          styleName: gathered.styleName,
          styleVersion: gathered.styleVersion,
          proposals: kept,
          dropped,
          evidence: gathered.evidence,
        };
        return {
          output: proposal,
          approval: kept.length
            ? { kind: "preferences", title: `Choose which changes to make to "${gathered.styleName}"`, proposal }
            : undefined,
        };
      },
    },
    {
      id: "apply",
      label: "Updating the style",
      async run(ctx) {
        const proposed = ctx.state.propose as { styleId: string; styleVersion: number; proposals: Proposal[] };
        if (proposed.proposals.length === 0) return { output: { applied: 0, reason: "No clear patterns in the feedback yet." } };
        const decision = ctx.approvals.preferences ?? {};
        const selected = Array.isArray(decision.selected)
          ? (decision.selected as number[]).filter((i) => Number.isInteger(i) && proposed.proposals[i])
          : [];
        if (selected.length === 0) return { output: { applied: 0, reason: "No changes were chosen." } };
        const style = await getStyle(proposed.styleId);
        if (!style || style.archived) throw new Error("That style no longer exists.");
        if (style.version !== proposed.styleVersion) {
          throw new Error(`"${style.name}" was edited after these suggestions were made (now version ${style.version}). Run this again to get suggestions for the current version.`);
        }
        const chosen = selected.map((i) => proposed.proposals[i]);
        const rules = applyProposals(style.rules, chosen);
        const updated = await updateStyle(
          style.id,
          { name: style.name, description: style.description, rules, exampleDocumentIds: style.exampleDocumentIds },
          ctx.run.createdBy ?? "admin",
          { note: `Learned from feedback: ${chosen.length} change(s) approved`, sourceRunId: ctx.run.id }
        );
        await ctx.log(`Saved "${style.name}" as version ${updated?.version}`, { changes: chosen.map((c) => `${c.action} ${c.field}: ${c.text}`) });
        return { output: { applied: chosen.length, styleId: style.id, version: updated?.version, changes: chosen } };
      },
    },
  ],
  result(state) {
    return (state.apply as Record<string, unknown>) ?? (state.propose as Record<string, unknown>) ?? {};
  },
};
