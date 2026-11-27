import { apiError } from "@/lib/http/errors";
import { archiveStyle, getStyle, styleInputSchema, updateStyle } from "@/lib/writing/ai/styles";
import { idSchema, json, parseBody, writingRoute } from "@/lib/writing/api";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };
const notFound = () => apiError("NOT_FOUND", "Style not found", 404);

export async function GET(_request: Request, props: Params) {
  const params = await props.params;
  return writingRoute(async () => {
    if (!idSchema.safeParse(params.id).success) return notFound();
    const style = await getStyle(params.id);
    return style ? json(style) : notFound();
  });
}

/** Save a new version of the style. */
export async function PUT(request: Request, props: Params) {
  const params = await props.params;
  return writingRoute(async (user) => {
    if (!idSchema.safeParse(params.id).success) return notFound();
    const body = await parseBody(request, styleInputSchema);
    if ("error" in body) return body.error;
    const style = await updateStyle(params.id, body.data, user.email ?? "admin");
    return style ? json(style) : notFound();
  });
}

/** Archive (hide) the style; its history is kept. */
export async function DELETE(_request: Request, props: Params) {
  const params = await props.params;
  return writingRoute(async () => {
    if (!idSchema.safeParse(params.id).success) return notFound();
    const result = await archiveStyle(params.id);
    if (result === "not_found") return notFound();
    if (result === "is_default") {
      return apiError("VALIDATION_FAILED", "Choose another default style before removing this one.", 409);
    }
    return json({ archived: true });
  });
}
