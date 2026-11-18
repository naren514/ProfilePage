import { apiError } from "@/lib/http/errors";
import { deleteSample, sampleUpdateSchema, updateSample } from "@/lib/writing/memory/samples";
import { idSchema, json, parseBody, writingRoute } from "@/lib/writing/api";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };
const notFound = () => apiError("NOT_FOUND", "Sample not found", 404);

export async function PATCH(request: Request, { params }: Params) {
  return writingRoute(async () => {
    if (!idSchema.safeParse(params.id).success) return notFound();
    const body = await parseBody(request, sampleUpdateSchema);
    if ("error" in body) return body.error;
    const sample = await updateSample(params.id, body.data);
    return sample ? json(sample) : notFound();
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  return writingRoute(async () => {
    if (!idSchema.safeParse(params.id).success) return notFound();
    return (await deleteSample(params.id)) ? json({ deleted: true }) : notFound();
  });
}
