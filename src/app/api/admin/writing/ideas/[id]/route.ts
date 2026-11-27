import { apiError } from "@/lib/http/errors";
import { deleteIdea, ideaUpdateSchema, updateIdea } from "@/lib/writing/ideas";
import { idSchema, json, parseBody, writingRoute } from "@/lib/writing/api";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, props: Params) {
  const params = await props.params;
  return writingRoute(async () => {
    if (!idSchema.safeParse(params.id).success) return apiError("NOT_FOUND", "Idea not found", 404);
    const body = await parseBody(request, ideaUpdateSchema);
    if ("error" in body) return body.error;
    const idea = await updateIdea(params.id, body.data);
    return idea ? json(idea) : apiError("NOT_FOUND", "Idea not found (or already turned into a draft)", 404);
  });
}

export async function DELETE(_request: Request, props: Params) {
  const params = await props.params;
  return writingRoute(async () => {
    if (!idSchema.safeParse(params.id).success) return apiError("NOT_FOUND", "Idea not found", 404);
    return (await deleteIdea(params.id)) ? json({ deleted: true }) : apiError("NOT_FOUND", "Idea not found", 404);
  });
}
