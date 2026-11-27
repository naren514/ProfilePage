import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { writingTriggers } from "@/lib/db/schema";
import { apiError } from "@/lib/http/errors";
import { getTrigger, triggerHistory } from "@/lib/agent/triggers";
import { nextRunAt, validateSchedule } from "@/lib/agent/schedule";
import { idSchema, json, parseBody, writingRoute } from "@/lib/writing/api";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  enabled: z.boolean().optional(),
  schedule: z.string().trim().min(9).max(100).optional(),
  timezone: z.string().trim().min(1).max(64).optional(),
  dailyBudgetUsd: z.number().min(0).max(20).optional(),
  // L2 (act and report) arrives in A4
  autonomyLevel: z.enum(["L0", "L1"]).optional(),
});

export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return writingRoute(async () => {
    if (!idSchema.safeParse(params.id).success) return apiError("NOT_FOUND", "Trigger not found", 404);
    const trigger = await getTrigger(params.id);
    if (!trigger) return apiError("NOT_FOUND", "Trigger not found", 404);
    return json({ trigger, history: await triggerHistory(trigger.id) });
  });
}

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return writingRoute(async () => {
    if (!idSchema.safeParse(params.id).success) return apiError("NOT_FOUND", "Trigger not found", 404);
    const trigger = await getTrigger(params.id);
    if (!trigger) return apiError("NOT_FOUND", "Trigger not found", 404);
    const body = await parseBody(request, patchSchema);
    if ("error" in body) return body.error;
    const patch = body.data;
    const schedule = patch.schedule ?? trigger.schedule;
    const timezone = patch.timezone ?? trigger.timezone;
    if (trigger.kind === "cron" && schedule) {
      try {
        validateSchedule(schedule, timezone);
      } catch (error) {
        return apiError("VALIDATION_FAILED", error instanceof Error ? error.message : "Invalid schedule", 400);
      }
    }
    const enabled = patch.enabled ?? trigger.enabled;
    const [updated] = await db
      .update(writingTriggers)
      .set({
        ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
        ...(patch.schedule !== undefined ? { schedule: patch.schedule } : {}),
        ...(patch.timezone !== undefined ? { timezone: patch.timezone } : {}),
        ...(patch.dailyBudgetUsd !== undefined ? { dailyBudgetUsd: patch.dailyBudgetUsd.toFixed(4) } : {}),
        ...(patch.autonomyLevel !== undefined ? { autonomyLevel: patch.autonomyLevel } : {}),
        // Turning a schedule on, or changing it, starts from the next slot after now.
        // Other edits (budget, level) keep the slot already scheduled.
        nextRunAt:
          trigger.kind === "cron" && schedule && enabled && (!trigger.enabled || patch.schedule !== undefined || patch.timezone !== undefined || !trigger.nextRunAt)
            ? nextRunAt(schedule, timezone, new Date())
            : trigger.nextRunAt,
        consecutiveFailures: patch.enabled ? 0 : trigger.consecutiveFailures,
        updatedAt: new Date(),
      })
      .where(eq(writingTriggers.id, trigger.id))
      .returning();
    return json({ trigger: updated });
  });
}
