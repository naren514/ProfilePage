import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/http/errors";
import { readingRoute } from "@/lib/reading/api";
import { regenerateSuggestion } from "@/lib/reading/items";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Ask the AI for a fresh note suggestion. */
export async function POST(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return readingRoute(async () => {
    if (!z.string().uuid().safeParse(params.id).success) return apiError("NOT_FOUND", "Not found", 404);
    const result = await regenerateSuggestion(params.id);
    if (!result) return apiError("NOT_FOUND", "This article isn't on your reading list any more.", 404);
    if (result.error) return apiError("AI_PROVIDER_ERROR", result.error, 502);
    return NextResponse.json({ item: result.item });
  });
}
