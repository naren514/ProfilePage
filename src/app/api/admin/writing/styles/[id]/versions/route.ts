import { apiError } from "@/lib/http/errors";
import { listStyleVersions } from "@/lib/writing/ai/styles";
import { idSchema, json, writingRoute } from "@/lib/writing/api";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  return writingRoute(async () => {
    if (!idSchema.safeParse(params.id).success) return apiError("NOT_FOUND", "Style not found", 404);
    return json({ versions: await listStyleVersions(params.id) });
  });
}
