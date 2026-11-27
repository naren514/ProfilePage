import { apiError } from "@/lib/http/errors";
import { createDocumentFromRun, createIdeaFromRun } from "@/lib/agent/apply";
import { RunRejected } from "@/lib/agent/runner";
import { idSchema, json, writingRoute } from "@/lib/writing/api";

export const dynamic = "force-dynamic";

/** Create a new draft from a finished outline or research report (once), or save a report as an idea ({"as":"idea"}). */
export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return writingRoute(async (user) => {
    if (!idSchema.safeParse(params.id).success) return apiError("NOT_FOUND", "Run not found", 404);
    try {
      const body = (await request.json().catch(() => null)) as { as?: string } | null;
      if (body?.as === "idea") return json(await createIdeaFromRun(params.id));
      return json(await createDocumentFromRun(params.id, user.email ?? "admin"));
    } catch (error) {
      if (error instanceof RunRejected) return apiError(error.code, error.message, error.status);
      throw error;
    }
  });
}
