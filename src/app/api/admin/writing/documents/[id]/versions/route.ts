import { listRevisions } from "@/lib/writing/documents";
import { failureResponse, idSchema, json, writingRoute } from "@/lib/writing/api";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  return writingRoute(async () => {
    if (!idSchema.safeParse(params.id).success) return failureResponse({ ok: false, reason: "not_found" });
    return json({ versions: await listRevisions(params.id) });
  });
}
