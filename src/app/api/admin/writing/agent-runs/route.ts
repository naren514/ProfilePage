import { z } from "zod";
import { apiError } from "@/lib/http/errors";
import { isProviderConfigured } from "@/lib/llm";
import { createRun, listRuns, presentRun, RunRejected } from "@/lib/agent/runner";
import { WORKFLOW_IDS, type WorkflowId } from "@/lib/agent/workflows";
import { isSearchConfigured } from "@/lib/agent/tavily";
import { json, parseBody, writingRoute } from "@/lib/writing/api";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  workflow: z.enum(WORKFLOW_IDS as [WorkflowId, ...WorkflowId[]]),
  documentId: z.string().uuid().optional(),
  ideaId: z.string().uuid().optional(),
  input: z.record(z.string(), z.unknown()).default({}),
});

export async function GET(request: Request) {
  return writingRoute(async () => {
    const url = new URL(request.url);
    const documentId = url.searchParams.get("documentId") ?? undefined;
    if (documentId && !z.string().uuid().safeParse(documentId).success) return json({ runs: [] });
    return json({
      runs: await listRuns({ documentId, limit: Math.min(Number(url.searchParams.get("limit")) || 50, 200) }),
      researchAvailable: isSearchConfigured(),
    });
  });
}

/** Start a workflow run. It doesn't execute until /advance is called. */
export async function POST(request: Request) {
  return writingRoute(async (user) => {
    if (!isProviderConfigured()) return apiError("AI_DISABLED", "AI isn't configured on the server (OPENAI_API_KEY is missing).", 503);
    const body = await parseBody(request, createSchema);
    if ("error" in body) return body.error;
    if (body.data.workflow === "research" && !isSearchConfigured()) {
      return apiError("AI_DISABLED", "Web research isn't set up: add TAVILY_API_KEY to the server's environment.", 503);
    }
    try {
      const run = await createRun({ ...body.data, createdBy: user.email ?? "admin" });
      return json(presentRun(run), { status: 201 });
    } catch (error) {
      if (error instanceof RunRejected) return apiError(error.code, error.message, error.status);
      throw error;
    }
  });
}
