import { z } from "zod";
import { apiError } from "@/lib/http/errors";
import { clearFeedback, listFeedback } from "@/lib/writing/memory/feedback";
import { json, writingRoute } from "@/lib/writing/api";

export const dynamic = "force-dynamic";

const STATUSES = ["accepted", "modified", "rejected", "stale", "cancelled"];

export async function GET(request: Request) {
  return writingRoute(async () => {
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const styleId = url.searchParams.get("styleId");
    return json({
      feedback: await listFeedback({
        status: status && STATUSES.includes(status) ? status : undefined,
        styleId: styleId && z.string().uuid().safeParse(styleId).success ? styleId : undefined,
      }),
    });
  });
}

/** Delete all feedback. Requires ?confirm=all so it can't happen by accident. */
export async function DELETE(request: Request) {
  return writingRoute(async () => {
    if (new URL(request.url).searchParams.get("confirm") !== "all") {
      return apiError("VALIDATION_FAILED", "Add ?confirm=all to delete all feedback.", 400);
    }
    return json({ deleted: await clearFeedback() });
  });
}
