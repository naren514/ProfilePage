import { restoreRevision } from "@/lib/writing/documents";
import { failureResponse, idSchema, json, parseBody, restoreSchema, writingRoute } from "@/lib/writing/api";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  return writingRoute(async (user) => {
    if (!idSchema.safeParse(params.id).success) return failureResponse({ ok: false, reason: "not_found" });
    const body = await parseBody(request, restoreSchema);
    if ("error" in body) return body.error;
    const result = await restoreRevision(params.id, body.data.revisionId, body.data.baseRevision, user.email ?? "admin");
    if (!result.ok) return failureResponse(result);
    return json({ currentRevision: result.doc.currentRevision });
  });
}
