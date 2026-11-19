import { NextRequest, NextResponse } from "next/server";
import { apiError, validationError } from "@/lib/http/errors";
import { rateLimitResponse, RATE_LIMITS } from "@/lib/rate-limit";
import { readingError, tokenSaveSchema, wantsPublish } from "@/lib/reading/api";
import { saveArticle } from "@/lib/reading/items";
import { bearerToken, verifyToken } from "@/lib/reading/tokens";

export const dynamic = "force-dynamic";
// Fetching the article and suggesting a note can take a few seconds
export const maxDuration = 30;

/**
 * Save an article to the reading list with a personal token
 * (Authorization: Bearer rd_…). Used by the iPhone "Save to Reading" Shortcut.
 */
export async function POST(request: NextRequest) {
  const limited = await rateLimitResponse(request, RATE_LIMITS.readingSave);
  if (limited) return limited;

  const token = bearerToken(request.headers.get("authorization"));
  try {
    if (!token || !(await verifyToken(token))) {
      return NextResponse.json({ error: "This token isn't valid. Create a new one in Admin → Reading → Ways to save.", code: "UNAUTHORIZED" }, { status: 401 });
    }

    const parsed = tokenSaveSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return validationError(parsed.error);
    const body = parsed.data;
    if (!body.url && !body.text) return apiError("VALIDATION_FAILED", "Send the article's link as url (or inside text).", 400);

    const publish = wantsPublish(body.publish);
    const { item, created } = await saveArticle({
      url: body.url,
      title: body.title,
      text: body.text,
      note: body.note,
      quote: body.quote,
      publish,
      via: "shortcut",
    });

    const where = item.status === "published" ? "published on your Reading list" : "saved to your Reading inbox";
    return NextResponse.json({
      ok: true,
      created,
      id: item.id,
      title: item.articleTitle,
      source: item.source,
      status: item.status,
      // A ready-made line for the Shortcut's notification
      message: `${created ? "" : "Already saved, updated: "}${item.articleTitle} — ${where}.`,
    });
  } catch (error) {
    return readingError(error);
  }
}
