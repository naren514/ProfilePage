import { randomUUID } from "crypto";
import { apiError } from "@/lib/http/errors";
import { fireTrigger, getTrigger } from "@/lib/agent/triggers";
import { idSchema, json, writingRoute } from "@/lib/writing/api";

export const dynamic = "force-dynamic";

/** "Run now": start this trigger's run immediately (counts as a click). Event triggers need their event. */
export async function POST(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return writingRoute(async () => {
    if (!idSchema.safeParse(params.id).success) return apiError("NOT_FOUND", "Trigger not found", 404);
    const trigger = await getTrigger(params.id);
    if (!trigger) return apiError("NOT_FOUND", "Trigger not found", 404);
    if (trigger.kind !== "cron") return apiError("VALIDATION_FAILED", "This automation runs when its event happens (for example, when you open Publish).", 400);
    const outcome = await fireTrigger(trigger, { fireKey: `manual:${randomUUID()}`, origin: "manual" });
    if (outcome.status === "skipped") return apiError("AI_BUDGET_EXCEEDED", `Not started: ${outcome.reason}.`, 409);
    return json(outcome, { status: 201 });
  });
}
