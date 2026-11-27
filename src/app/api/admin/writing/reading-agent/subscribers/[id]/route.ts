import { apiError } from "@/lib/http/errors";
import { removeSubscriber } from "@/lib/reading/subscribers";
import { idSchema, json, writingRoute } from "@/lib/writing/api";

export const dynamic = "force-dynamic";

/** Remove a subscriber (and their address) completely. */
export async function DELETE(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return writingRoute(async () => {
    if (!idSchema.safeParse(params.id).success || !(await removeSubscriber(params.id))) return apiError("NOT_FOUND", "Not found", 404);
    return json({ ok: true });
  });
}
