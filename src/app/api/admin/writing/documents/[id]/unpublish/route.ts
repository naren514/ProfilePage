import { unpublishDocument } from "@/lib/writing/documents";
import { failureResponse, idSchema, json, writingRoute } from "@/lib/writing/api";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return writingRoute(async () => {
    if (!idSchema.safeParse(params.id).success) return failureResponse({ ok: false, reason: "not_found" });
    const result = await unpublishDocument(params.id);
    if (!result.ok) return failureResponse(result);
    return json({ unpublished: true });
  });
}
