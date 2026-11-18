import { z } from "zod";
import { createSample, listSamples, sampleInputSchema } from "@/lib/writing/memory/samples";
import { json, parseBody, writingRoute } from "@/lib/writing/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return writingRoute(async () => {
    const url = new URL(request.url);
    const styleId = url.searchParams.get("styleId");
    return json({
      samples: await listSamples({
        q: url.searchParams.get("q") ?? undefined,
        styleId: styleId && z.string().uuid().safeParse(styleId).success ? styleId : undefined,
      }),
    });
  });
}

/** Save a passage as a writing sample (only ever on the author's request). */
export async function POST(request: Request) {
  return writingRoute(async () => {
    const body = await parseBody(request, sampleInputSchema);
    if ("error" in body) return body.error;
    return json(await createSample(body.data), { status: 201 });
  });
}
