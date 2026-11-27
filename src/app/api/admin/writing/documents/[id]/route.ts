import { deleteDocument, getDocument, presentDocument, saveDocument } from "@/lib/writing/documents";
import { failureResponse, idSchema, json, parseBody, saveDocumentSchema, writingRoute } from "@/lib/writing/api";
import { apiError } from "@/lib/http/errors";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, props: Params) {
  const params = await props.params;
  return writingRoute(async () => {
    if (!idSchema.safeParse(params.id).success) return failureResponse({ ok: false, reason: "not_found" });
    const found = await getDocument(params.id);
    if (!found) return failureResponse({ ok: false, reason: "not_found" });
    return json(presentDocument(found.doc, found.story));
  });
}

/** Autosave and manual save. Requires baseRevision; returns 409 if it's stale. */
export async function PATCH(request: Request, props: Params) {
  const params = await props.params;
  return writingRoute(async (user) => {
    if (!idSchema.safeParse(params.id).success) return failureResponse({ ok: false, reason: "not_found" });
    const body = await parseBody(request, saveDocumentSchema);
    if ("error" in body) return body.error;
    const result = await saveDocument(params.id, body.data, user.email ?? "admin");
    if (!result.ok) return failureResponse(result);
    const { doc } = result;
    return json({ id: doc.id, currentRevision: doc.currentRevision, updatedAt: doc.updatedAt, wordCount: doc.wordCount });
  });
}

export async function DELETE(_request: Request, props: Params) {
  const params = await props.params;
  return writingRoute(async () => {
    if (!idSchema.safeParse(params.id).success) return apiError("NOT_FOUND", "Document not found", 404);
    const result = await deleteDocument(params.id);
    if (!result.ok) return failureResponse(result);
    return json({ deleted: true });
  });
}
