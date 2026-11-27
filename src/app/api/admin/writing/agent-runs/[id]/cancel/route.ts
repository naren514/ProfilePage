import { apiError } from "@/lib/http/errors";
import { cancelRun, listEvents, presentRun } from "@/lib/agent/runner";
import { idSchema, json, writingRoute } from "@/lib/writing/api";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return writingRoute(async (user) => {
    if (!idSchema.safeParse(params.id).success) return apiError("NOT_FOUND", "Run not found", 404);
    const run = await cancelRun(params.id, user.email ?? "admin");
    if (!run) return apiError("NOT_FOUND", "Run not found", 404);
    return json({ run: presentRun(run), events: await listEvents(run.id) });
  });
}
