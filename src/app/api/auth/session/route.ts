import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSessionCookie, verifyIdToken } from "@/lib/firebase/admin";

// Session cookie expires in 5 days
const SESSION_EXPIRY = 60 * 60 * 24 * 5 * 1000;

// Get allowed admin emails from environment variable
function getAllowedEmails(): string[] {
  const emails = process.env.ALLOWED_ADMIN_EMAILS || "";
  return emails.split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
}

export async function POST(request: NextRequest) {
  try {
    const { idToken } = await request.json();

    if (!idToken) {
      return NextResponse.json({ error: "ID token required" }, { status: 400 });
    }

    // Verify the ID token
    const decodedToken = await verifyIdToken(idToken);

    if (!decodedToken) {
      return NextResponse.json({ error: "Invalid ID token" }, { status: 401 });
    }

    // Check if user is in allowed emails list
    const allowedEmails = getAllowedEmails();
    const userEmail = decodedToken.email?.toLowerCase();

    if (!userEmail || !allowedEmails.includes(userEmail)) {
      return NextResponse.json(
        { error: "You are not authorized to access the admin portal" },
        { status: 403 }
      );
    }

    // Create session cookie
    const sessionCookie = await createSessionCookie(idToken, SESSION_EXPIRY);

    if (!sessionCookie) {
      return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
    }

    // Set the session cookie
    const cookieStore = await cookies();
    cookieStore.set("session", sessionCookie, {
      maxAge: SESSION_EXPIRY / 1000,
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
    cookieStore.delete("session");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Session deletion error:", error);
    return NextResponse.json({ error: "Failed to delete session" }, { status: 500 });
  }
}
