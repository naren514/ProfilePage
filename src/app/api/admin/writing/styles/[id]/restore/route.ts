import { z } from "zod";
import { apiError } from "@/lib/http/errors";
import { restoreStyleVersion } from "@/lib/writing/ai/styles";
import { idSchema, json, parseBody, writingRoute } from "@/lib/writing/api";

export const dynamic = "force-dynamic";

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return writingRoute(async (user) => {
    if (!idSchema.safeParse(params.id).success) return apiError("NOT_FOUND", "Style not found", 404);
    const body = await parseBody(request, z.object({ versionId: z.string().uuid() }));
    if ("error" in body) return body.error;
    const style = await restoreStyleVersion(params.id, body.data.versionId, user.email ?? "admin");
    return style ? json(style) : apiError("NOT_FOUND", "Version not found", 404);
  });
}
