import { apiError } from "@/lib/http/errors";
import { archiveConversation, getConversation } from "@/lib/writing/ai/chat";
import { idSchema, json, writingRoute } from "@/lib/writing/api";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

export async function GET(_request: Request, { params }: Params) {
  return writingRoute(async () => {
    if (!idSchema.safeParse(params.id).success) return apiError("NOT_FOUND", "Conversation not found", 404);
    const found = await getConversation(params.id);
    return found ? json(found) : apiError("NOT_FOUND", "Conversation not found", 404);
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  return writingRoute(async () => {
    if (!idSchema.safeParse(params.id).success) return apiError("NOT_FOUND", "Conversation not found", 404);
    return (await archiveConversation(params.id)) ? json({ archived: true }) : apiError("NOT_FOUND", "Conversation not found", 404);
  });
}
