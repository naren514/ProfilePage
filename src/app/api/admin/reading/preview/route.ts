import { NextRequest, NextResponse } from "next/server";
import { validationError } from "@/lib/http/errors";
import { previewSchema, readingRoute } from "@/lib/reading/api";
import { previewArticle } from "@/lib/reading/items";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Article details and a note suggestion for the save popup; saves nothing. */
export async function POST(request: NextRequest) {
  return readingRoute(async () => {
    const parsed = previewSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return validationError(parsed.error);
    return NextResponse.json(await previewArticle(parsed.data));
  });
}
