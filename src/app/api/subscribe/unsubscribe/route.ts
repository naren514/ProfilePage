import { NextRequest, NextResponse } from "next/server";
import { unsubscribe } from "@/lib/reading/subscribers";

export const dynamic = "force-dynamic";

/**
 * Unsubscribe. Mail apps' one-click button posts here with the token in the
 * address (RFC 8058); the /unsubscribe page posts a form with it.
 */
export async function POST(request: NextRequest) {
  let token = request.nextUrl.searchParams.get("token") ?? "";
  const type = request.headers.get("content-type") ?? "";
  if (!token && (type.includes("form") || type.includes("multipart"))) token = String((await request.formData().catch(() => null))?.get("token") ?? "");
  const ok = await unsubscribe(token).catch(() => false);
  const fromPage = request.headers.get("accept")?.includes("text/html");
  if (fromPage) return NextResponse.redirect(new URL(`/unsubscribe?done=${ok ? "1" : "invalid"}`, request.nextUrl), 303);
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
}
