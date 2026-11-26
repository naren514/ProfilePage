import { z } from "zod";
import { apiError } from "@/lib/http/errors";
import { decideRun, listEvents, presentRun, RunRejected } from "@/lib/agent/runner";
import { idSchema, json, parseBody, writingRoute } from "@/lib/writing/api";

export const dynamic = "force-dynamic";

const decideSchema = z.object({
  action: z.enum(["approve", "regenerate", "decline"]),
  stepIndex: z.number().int().min(0),
  decision: z
    .record(z.string(), z.unknown())
    // The author's note to the assistant (AP-003): plain text, at most 1,000 characters
    .refine((d) => d.instruction === undefined || (typeof d.instruction === "string" && d.instruction.length <= 1000), { message: "The note can be at most 1,000 characters." })
    .optional(),
  idempotencyKey: z.string().min(8).max(100),
});

/** The author's decision at a checkpoint. Recorded with who decided and when. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  return writingRoute(async (user) => {
    if (!idSchema.safeParse(params.id).success) return apiError("NOT_FOUND", "Run not found", 404);
    const body = await parseBody(request, decideSchema);
    if ("error" in body) return body.error;
    try {
      const run = await decideRun(params.id, body.data, user.email ?? "admin");
      if (!run) return apiError("NOT_FOUND", "Run not found", 404);
      return json({ run: presentRun(run), events: await listEvents(run.id) });
    } catch (error) {
      if (error instanceof RunRejected) return apiError(error.code, error.message, error.status);
      throw error;
    }
  });
}
