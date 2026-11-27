import { createConversation, listConversations } from "@/lib/writing/ai/chat";
import { failureResponse, idSchema, json, writingRoute } from "@/lib/writing/api";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return writingRoute(async () => {
    if (!idSchema.safeParse(params.id).success) return failureResponse({ ok: false, reason: "not_found" });
    return json({ conversations: await listConversations(params.id) });
  });
}

/** Start a fresh conversation (the old ones stay in the list). */
export async function POST(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return writingRoute(async () => {
    if (!idSchema.safeParse(params.id).success) return failureResponse({ ok: false, reason: "not_found" });
    return json(await createConversation(params.id), { status: 201 });
  });
}
