import { emailConfigured } from "@/lib/email/send";
import { apiError } from "@/lib/http/errors";
import { emailWeeklyList } from "@/lib/reading/subscribers";
import { idSchema, json, writingRoute } from "@/lib/writing/api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Email a published list now (if it hasn't gone out, or sending failed before). */
export async function POST(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return writingRoute(async () => {
    if (!idSchema.safeParse(params.id).success) return apiError("NOT_FOUND", "List not found", 404);
    if (!emailConfigured()) return apiError("VALIDATION_FAILED", "Email isn't set up yet.", 400);
    try {
      const out = await emailWeeklyList(params.id);
      if (out.skipped === "not_found") return apiError("NOT_FOUND", "List not found", 404);
      if (out.skipped === "already_sent") return apiError("VALIDATION_FAILED", "This list was already emailed.", 409);
      return json(out);
    } catch (error) {
      return apiError("INTERNAL", error instanceof Error ? error.message : "Couldn't send it", 502);
    }
  });
}
