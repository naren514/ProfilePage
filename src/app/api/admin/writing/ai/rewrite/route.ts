import { apiError } from "@/lib/http/errors";
import { isProviderConfigured } from "@/lib/llm";
import { prepareRewrite, rewriteRequestSchema, RewriteRejected, streamRewrite } from "@/lib/writing/ai/rewrite";
import { parseBody, writingRoute } from "@/lib/writing/api";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Propose a rewrite of the selected passage. Streams server-sent events; never edits the document. */
export async function POST(request: Request) {
  return writingRoute(async () => {
    if (!isProviderConfigured()) {
      return apiError("AI_DISABLED", "AI isn't configured on the server (OPENAI_API_KEY is missing).", 503);
    }
    const body = await parseBody(request, rewriteRequestSchema);
    if ("error" in body) return body.error;
    let prepared;
    try {
      prepared = await prepareRewrite(body.data);
    } catch (error) {
      if (error instanceof RewriteRejected) return apiError(error.code, error.message, error.status);
      throw error;
    }
    return new Response(streamRewrite(body.data, prepared, request.signal), {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  });
}
