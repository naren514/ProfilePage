import { NextRequest, NextResponse } from "next/server";
import { confirmSubscription } from "@/lib/reading/subscribers";

export const dynamic = "force-dynamic";

/** The link in the confirmation email. */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const ok = await confirmSubscription(token).catch(() => false);
  return NextResponse.redirect(new URL(`/reading/weekly?subscribed=${ok ? "1" : "invalid"}`, request.nextUrl), 303);
}
