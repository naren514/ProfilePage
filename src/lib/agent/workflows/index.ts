import type { WorkflowDef } from "../types";
import { draftWorkflow } from "./draft";
import { exploreWorkflow } from "./explore";
import { publishPrepWorkflow } from "./publish-prep";
import { researchWorkflow } from "./research";
import { reviewWorkflow } from "./review";

export const WORKFLOWS = {
  explore: exploreWorkflow,
  draft: draftWorkflow,
  research: researchWorkflow,
  review: reviewWorkflow,
  publish_prep: publishPrepWorkflow,
} satisfies Record<string, WorkflowDef>;

export type WorkflowId = keyof typeof WORKFLOWS;
export const WORKFLOW_IDS = Object.keys(WORKFLOWS) as WorkflowId[];
