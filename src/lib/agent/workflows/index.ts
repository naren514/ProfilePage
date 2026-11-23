import type { WorkflowDef } from "../types";
import { draftWorkflow } from "./draft";
import { exploreWorkflow } from "./explore";
import { publishPrepWorkflow } from "./publish-prep";
import { researchWorkflow } from "./research";
import { reviewWorkflow } from "./review";
import { learnWorkflow } from "./learn";
import { digestWorkflow } from "./digest";
import { researchAgentWorkflow } from "./research-agent";

export const WORKFLOWS = {
  explore: exploreWorkflow,
  draft: draftWorkflow,
  research: researchWorkflow,
  review: reviewWorkflow,
  publish_prep: publishPrepWorkflow,
  learn: learnWorkflow,
  digest: digestWorkflow,
  research_agent: researchAgentWorkflow,
} satisfies Record<string, WorkflowDef>;

export type WorkflowId = keyof typeof WORKFLOWS;
export const WORKFLOW_IDS = Object.keys(WORKFLOWS) as WorkflowId[];
