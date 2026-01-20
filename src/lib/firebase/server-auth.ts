import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifySessionCookie } from "./admin";

// Get allowed admin emails from environment variable
function getAllowedEmails(): string[] {
  const emails = process.env.ALLOWED_ADMIN_EMAILS || "";
  return emails.split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
}

export interface ServerUser {
  uid: string;
  email: string | undefined;
  name?: string;
}

/**
 * Get the current authenticated user from the session cookie.
 * Returns null if not authenticated or not authorized.
 */
export async function getServerUser(): Promise<ServerUser | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;

    if (!sessionCookie) {
      return null;
    }

    const decodedToken = await verifySessionCookie(sessionCookie);

    if (!decodedToken) {
      return null;
    }

    // Check if user is in allowed emails list
    const allowedEmails = getAllowedEmails();
    const userEmail = decodedToken.email?.toLowerCase();

    if (!userEmail || !allowedEmails.includes(userEmail)) {
      console.warn(`Unauthorized access attempt by: ${userEmail}`);
      return null;
    }

    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name,
    };
  } catch (error) {
    console.error("Error getting server user:", error);
    return null;
  }
}

/**
 * Require authentication for API routes.
 * Returns a 401 response if not authenticated.
 */
export async function requireAuth(): Promise<ServerUser | NextResponse> {
  const user = await getServerUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return user;
}

/**
 * Check if a response is an unauthorized response.
 */
export function isUnauthorizedResponse(result: ServerUser | NextResponse): result is NextResponse {
  return result instanceof NextResponse;
}
