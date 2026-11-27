import { apiError } from "@/lib/http/errors";
import { advanceRun, listEvents, presentRun } from "@/lib/agent/runner";
import { idSchema, json, writingRoute } from "@/lib/writing/api";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Run the next step (if any). Safe to call repeatedly or from two tabs. */
export async function POST(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return writingRoute(async () => {
    if (!idSchema.safeParse(params.id).success) return apiError("NOT_FOUND", "Run not found", 404);
    const run = await advanceRun(params.id);
    if (!run) return apiError("NOT_FOUND", "Run not found", 404);
    return json({ run: presentRun(run), events: await listEvents(run.id) });
  });
}
