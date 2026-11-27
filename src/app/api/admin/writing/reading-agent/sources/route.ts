import { z } from "zod";
import { apiError } from "@/lib/http/errors";
import { addSource, checkSource } from "@/lib/reading/feeds";
import { json, parseBody, writingRoute } from "@/lib/writing/api";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Add a source (a site or a feed address); its feed is found right away. */
export async function POST(request: Request) {
  return writingRoute(async () => {
    const body = await parseBody(request, z.object({ url: z.string().trim().min(4).max(500), topic: z.string().trim().max(60).default(""), name: z.string().trim().max(120).optional() }));
    if ("error" in body) return body.error;
    try {
      const source = await addSource(body.data);
      return json({ source: (await checkSource(source.id)) ?? source }, { status: 201 });
    } catch (error) {
      return apiError("VALIDATION_FAILED", error instanceof Error ? error.message : "Couldn't add that source.", 400);
    }
  });
}
