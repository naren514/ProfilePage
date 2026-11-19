import { NextRequest, NextResponse } from "next/server";
import { validationError } from "@/lib/http/errors";
import { adminSaveSchema, readingRoute } from "@/lib/reading/api";
import { countByStatus, listItems, saveArticle, type ReadingStatus } from "@/lib/reading/items";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const STATUSES: ReadingStatus[] = ["inbox", "published", "archived"];

export async function GET(request: NextRequest) {
  return readingRoute(async () => {
    const requested = request.nextUrl.searchParams.get("status") as ReadingStatus | null;
    const status = requested && STATUSES.includes(requested) ? requested : "inbox";
    const [items, counts] = await Promise.all([listItems(status), countByStatus()]);
    return NextResponse.json({ items, counts });
  });
}

export async function POST(request: NextRequest) {
  return readingRoute(async () => {
    const parsed = adminSaveSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return validationError(parsed.error);
    const result = await saveArticle(parsed.data);
    return NextResponse.json(result);
  });
}
