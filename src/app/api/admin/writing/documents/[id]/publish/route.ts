import { publishDocument } from "@/lib/writing/documents";
import { failureResponse, idSchema, json, parseBody, publishSchema, writingRoute } from "@/lib/writing/api";

export const dynamic = "force-dynamic";

/** Publish the draft at baseRevision. Idempotent per idempotencyKey. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  return writingRoute(async (user) => {
    if (!idSchema.safeParse(params.id).success) return failureResponse({ ok: false, reason: "not_found" });
    const body = await parseBody(request, publishSchema);
    if ("error" in body) return body.error;
    const result = await publishDocument(params.id, body.data, user.email ?? "admin");
    if (!result.ok) return failureResponse(result);
    return json({ storyId: result.storyId, slug: result.slug, url: `/thoughts/${result.slug}`, alreadyPublished: Boolean(result.alreadyPublished) });
  });
}
