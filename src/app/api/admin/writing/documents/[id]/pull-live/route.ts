import { pullLiveVersion } from "@/lib/writing/documents";
import { baseRevisionSchema, failureResponse, idSchema, json, parseBody, writingRoute } from "@/lib/writing/api";

export const dynamic = "force-dynamic";

/** Replace the draft with the live post (after edits made in the classic editor). */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  return writingRoute(async (user) => {
    if (!idSchema.safeParse(params.id).success) return failureResponse({ ok: false, reason: "not_found" });
    const body = await parseBody(request, baseRevisionSchema);
    if ("error" in body) return body.error;
    const result = await pullLiveVersion(params.id, body.data.baseRevision, user.email ?? "admin");
    if (!result.ok) return failureResponse(result);
    return json({ currentRevision: result.doc.currentRevision });
  });
}
