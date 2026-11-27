import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { emailConfigured } from "@/lib/email/send";
import { rateLimitResponse, RATE_LIMITS } from "@/lib/rate-limit";
import { subscribe } from "@/lib/reading/subscribers";

export const dynamic = "force-dynamic";

const body = z.object({ email: z.string().max(300), website: z.string().max(300).optional() });
const CHECK_INBOX = "Check your inbox: we sent a link to confirm.";

/** Sign up for the weekly list by email (double opt-in). */
export async function POST(request: NextRequest) {
  if (!emailConfigured()) return NextResponse.json({ error: "Email sign-ups aren't open yet." }, { status: 503 });
  const limited = await rateLimitResponse(request, RATE_LIMITS.subscribe);
  if (limited) return limited;
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter an email address." }, { status: 400 });
  // A field people can't see: only bots fill it in. Pretend it worked.
  if (parsed.data.website) return NextResponse.json({ ok: true, message: CHECK_INBOX });
  try {
    const outcome = await subscribe(parsed.data.email);
    if (outcome === "invalid") return NextResponse.json({ error: "That doesn't look like an email address." }, { status: 400 });
    // The same answer whether or not the address was already subscribed
    return NextResponse.json({ ok: true, message: CHECK_INBOX });
  } catch (error) {
    console.error("Subscribe failed:", error);
    return NextResponse.json({ error: "Couldn't sign you up just now. Please try again later." }, { status: 503 });
  }
}
