import { z } from "zod";
import { apiError } from "@/lib/http/errors";
import { setCandidateStatus } from "@/lib/reading/shortlist";
import { idSchema, json, parseBody, writingRoute } from "@/lib/writing/api";

export const dynamic = "force-dynamic";

/** Remove a candidate from the shortlist (it won't be suggested again), or put it back. */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  return writingRoute(async () => {
    if (!idSchema.safeParse(params.id).success) return apiError("NOT_FOUND", "Not on the shortlist", 404);
    const body = await parseBody(request, z.object({ status: z.enum(["active", "dropped"]) }));
    if ("error" in body) return body.error;
    const row = await setCandidateStatus(params.id, body.data.status);
    if (!row) return apiError("NOT_FOUND", "Not on the shortlist", 404);
    return json({ candidate: row });
  });
}
