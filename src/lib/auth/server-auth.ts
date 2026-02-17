import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/auth/session";

export interface ServerUser {
  uid: string;
  email: string | undefined;
  name?: string;
}

export async function getServerUser(): Promise<ServerUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("session")?.value;
    const user = verifySessionToken(token);

    if (!user) return null;

    return {
      uid: user.email,
      email: user.email,
      name: user.email.split("@")[0],
    };
  } catch (error) {
    console.error("Error getting server user:", error);
    return null;
  }
}

export async function requireAuth(): Promise<ServerUser | NextResponse> {
  const user = await getServerUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return user;
}

export function isUnauthorizedResponse(result: ServerUser | NextResponse): result is NextResponse {
  return result instanceof NextResponse;
}
