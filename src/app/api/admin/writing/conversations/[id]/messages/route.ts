import { apiError } from "@/lib/http/errors";
import { isProviderConfigured } from "@/lib/llm";
import { ChatRejected, sendMessageSchema, streamChatReply } from "@/lib/writing/ai/chat";
import { idSchema, parseBody, writingRoute } from "@/lib/writing/api";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Send a message; the reply streams back as server-sent events (delta, done, error). */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  return writingRoute(async () => {
    if (!idSchema.safeParse(params.id).success) return apiError("NOT_FOUND", "Conversation not found", 404);
    if (!isProviderConfigured()) return apiError("AI_DISABLED", "AI isn't configured on the server (OPENAI_API_KEY is missing).", 503);
    const body = await parseBody(request, sendMessageSchema);
    if ("error" in body) return body.error;
    try {
      const stream = await streamChatReply(params.id, body.data.content, request.signal);
      return new Response(stream, {
        headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" },
      });
    } catch (error) {
      if (error instanceof ChatRejected) return apiError(error.code, error.message, error.status);
      throw error;
    }
  });
}
