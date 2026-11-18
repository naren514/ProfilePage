import { apiError } from "@/lib/http/errors";
import { deleteFeedback } from "@/lib/writing/memory/feedback";
import { idSchema, json, writingRoute } from "@/lib/writing/api";

export const dynamic = "force-dynamic";

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  return writingRoute(async () => {
    if (!idSchema.safeParse(params.id).success) return apiError("NOT_FOUND", "Not found", 404);
    return (await deleteFeedback(params.id)) ? json({ deleted: true }) : apiError("NOT_FOUND", "Not found", 404);
  });
}
