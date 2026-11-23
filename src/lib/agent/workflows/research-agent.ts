import { z } from "zod";
import { agentTurn, type Playbook } from "../loop";
import { RESEARCH_TOOLS } from "../tools/research-tools";
import type { WorkflowDef } from "../types";
import { researchWorkflow } from "./research";

// A2: Research as a playbook. The model plans its own searches, decides when
// to read a source in full, searches again when results are thin or
// one-sided, and proposes findings when the evidence is good enough. The
// proposal and result have the same shape as the scripted workflow's.

export const RESEARCH_PLAYBOOK: Playbook = {
  id: "research",
  guidance:
    "Goal of this playbook: answer the question with findings the author can trust. Look for reliable, varied sources, including ones that disagree. Read a source in full when its snippet isn't enough to support a claim. When you have enough evidence (or the budget is nearly used), propose findings that each cite the sources supporting them.",
  suggestedPlan: [
    "Understand the question (read the post if it helps)",
    "Search with one or two specific queries",
    "Search again with different words if results are thin, repetitive or one-sided",
    "Read the most important sources in full",
    "Propose findings with citations, disagreements and open questions",
  ],
  tools: RESEARCH_TOOLS,
  maxTurns: 14,
};

export const researchAgentWorkflow: WorkflowDef = {
  id: "research_agent",
  label: "Research (agent)",
  description: "The agent plans its own searches, reads sources in full when needed, and proposes cited findings.",
  tools: ["web.search", "web.fetch"],
  needsDocument: true,
  inputSchema: z.object({ question: z.string().trim().min(3, "What should be researched?").max(1000) }),
  steps: [],
  agentTurn: (ctx) => agentTurn(ctx, RESEARCH_PLAYBOOK),
  // Same result shape as scripted Research, built from the same approved proposal
  result: researchWorkflow.result,
};
