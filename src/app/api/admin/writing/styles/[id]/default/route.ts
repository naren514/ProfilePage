import { apiError } from "@/lib/http/errors";
import { setDefaultStyle } from "@/lib/writing/ai/styles";
import { idSchema, json, writingRoute } from "@/lib/writing/api";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  return writingRoute(async () => {
    if (!idSchema.safeParse(params.id).success || !(await setDefaultStyle(params.id))) {
      return apiError("NOT_FOUND", "Style not found", 404);
    }
    return json({ isDefault: true });
  });
}
