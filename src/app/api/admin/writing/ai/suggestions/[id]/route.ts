import { resolveSuggestion, resolveSuggestionSchema } from "@/lib/writing/ai/rewrite";
import { failureResponse, idSchema, json, parseBody, writingRoute } from "@/lib/writing/api";

export const dynamic = "force-dynamic";

/** Record whether a suggestion was accepted, rejected or went stale. */
export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return writingRoute(async () => {
    if (!idSchema.safeParse(params.id).success) return failureResponse({ ok: false, reason: "not_found" });
    const body = await parseBody(request, resolveSuggestionSchema);
    if ("error" in body) return body.error;
    const updated = await resolveSuggestion(params.id, null, body.data);
    return json({ updated });
  });
}
