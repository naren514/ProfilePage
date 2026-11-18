import type { ModelTier } from "./config";

export interface Operation {
  label: string;
  tier: ModelTier;
  /** What the editor is asked to do. */
  task: string;
  /** Output length relative to the passage, for the token cap. */
  outputFactor: number;
}

export const OPERATIONS = {
  improve: {
    label: "Improve clarity",
    tier: "quality",
    task: "Rewrite the passage so it is clearer and easier to follow. Keep its meaning, facts and roughly the same length.",
    outputFactor: 1.5,
  },
  flow: {
    label: "Improve flow",
    tier: "quality",
    task: "Improve how the passage reads: smoother transitions, varied sentence rhythm, logical order. Keep the meaning and roughly the same length.",
    outputFactor: 1.5,
  },
  shorten: {
    label: "Shorten",
    tier: "fast",
    task: "Make the passage noticeably shorter (about half the length) while keeping its key point and the author's voice.",
    outputFactor: 1,
  },
  expand: {
    label: "Expand",
    tier: "quality",
    task: "Develop the passage further with a supporting detail, example or explanation that fits the surrounding text. Do not invent facts, statistics, quotes, names or sources; where a specific fact would be needed, write a placeholder like [add: source for this claim].",
    outputFactor: 3,
  },
  simplify: {
    label: "Simplify",
    tier: "fast",
    task: "Rewrite the passage in plainer words and shorter sentences so a general reader understands it easily. Keep the meaning.",
    outputFactor: 1.5,
  },
  grammar: {
    label: "Fix grammar",
    tier: "fast",
    task: "Fix spelling, grammar and punctuation only. Change as little as possible and keep the author's wording and voice.",
    outputFactor: 1.3,
  },
  style: {
    label: "Rewrite in style",
    tier: "quality",
    task: "Rewrite the passage so it closely follows the writing style described below. Keep the meaning and facts.",
    outputFactor: 1.6,
  },
  custom: {
    label: "Custom instruction",
    tier: "quality",
    task: "Edit the passage as the author asks in the instruction below.",
    outputFactor: 2,
  },
} satisfies Record<string, Operation>;

export type OperationId = keyof typeof OPERATIONS;
export const OPERATION_IDS = Object.keys(OPERATIONS) as OperationId[];
