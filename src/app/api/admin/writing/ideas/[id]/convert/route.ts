import { apiError } from "@/lib/http/errors";
import { convertIdea } from "@/lib/writing/ideas";
import { idSchema, json, writingRoute } from "@/lib/writing/api";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return writingRoute(async (user) => {
    if (!idSchema.safeParse(params.id).success) return apiError("NOT_FOUND", "Idea not found", 404);
    const result = await convertIdea(params.id, user.email ?? "admin");
    return result ? json(result) : apiError("NOT_FOUND", "Idea not found", 404);
  });
}
