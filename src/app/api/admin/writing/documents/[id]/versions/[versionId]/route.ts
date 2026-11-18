import { getRevision } from "@/lib/writing/documents";
import { documentToHtml } from "@/lib/writing/content";
import { failureResponse, idSchema, json, writingRoute } from "@/lib/writing/api";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { id: string; versionId: string } }) {
  return writingRoute(async () => {
    if (!idSchema.safeParse(params.id).success || !idSchema.safeParse(params.versionId).success) {
      return failureResponse({ ok: false, reason: "not_found" });
    }
    const revision = await getRevision(params.id, params.versionId);
    if (!revision) return failureResponse({ ok: false, reason: "not_found" });
    const { legacyHtml, ...rest } = revision;
    return json({ ...rest, hasLegacyHtml: Boolean(legacyHtml), html: documentToHtml(revision.bodyJson) });
  });
}
