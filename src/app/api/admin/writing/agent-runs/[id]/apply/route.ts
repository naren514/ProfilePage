import { apiError } from "@/lib/http/errors";
import { createDocumentFromRun } from "@/lib/agent/apply";
import { RunRejected } from "@/lib/agent/runner";
import { idSchema, json, writingRoute } from "@/lib/writing/api";

export const dynamic = "force-dynamic";

/** Create a new draft from a finished Idea → outline run (once). */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  return writingRoute(async (user) => {
    if (!idSchema.safeParse(params.id).success) return apiError("NOT_FOUND", "Run not found", 404);
    try {
      return json(await createDocumentFromRun(params.id, user.email ?? "admin"));
    } catch (error) {
      if (error instanceof RunRejected) return apiError(error.code, error.message, error.status);
      throw error;
    }
  });
}
