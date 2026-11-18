import { apiError } from "@/lib/http/errors";
import { getRun, listEvents, presentRun } from "@/lib/agent/runner";
import { idSchema, json, writingRoute } from "@/lib/writing/api";

export const dynamic = "force-dynamic";

/** The run and its full event timeline (audit trail). */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  return writingRoute(async () => {
    if (!idSchema.safeParse(params.id).success) return apiError("NOT_FOUND", "Run not found", 404);
    const run = await getRun(params.id);
    if (!run) return apiError("NOT_FOUND", "Run not found", 404);
    return json({ run: presentRun(run), events: await listEvents(run.id) });
  });
}
