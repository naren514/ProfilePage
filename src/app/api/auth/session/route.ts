import { createHash, timingSafeEqual } from "crypto";
import { rateLimitResponse, RATE_LIMITS } from "@/lib/rate-limit";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  createSessionToken,
  getConfiguredAdminEmail,
  verifySessionToken,
} from "@/lib/auth/session";

const COOKIE_NAME = "session";
const SESSION_EXPIRY_MS = 1000 * 60 * 60 * 24 * 5;

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const user = verifySessionToken(token);

  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({ authenticated: true, user });
}

/** Compare secrets in constant time (no timing hints about how much matched). */
function sameSecret(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export async function POST(request: NextRequest) {
  const limited = await rateLimitResponse(request, RATE_LIMITS.login);
  if (limited) return limited;
  try {
    const { email, password } = await request.json();

    const adminEmail = getConfiguredAdminEmail();
    const adminPassword = process.env.ADMIN_PASSWORD || "";

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    if (!adminEmail || !adminPassword) {
      return NextResponse.json(
        { error: "Admin credentials are not configured on the server" },
        { status: 500 }
      );
    }

    const emailOk = sameSecret(String(email).trim().toLowerCase(), adminEmail);
    const passwordOk = sameSecret(String(password), adminPassword);
    if (!emailOk || !passwordOk) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const sessionCookie = createSessionToken({ email: adminEmail }, SESSION_EXPIRY_MS);

    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, sessionCookie, {
      maxAge: SESSION_EXPIRY_MS / 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Session creation error:", error);
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(COOKIE_NAME);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Session deletion error:", error);
    return NextResponse.json({ error: "Failed to delete session" }, { status: 500 });
  }
}
