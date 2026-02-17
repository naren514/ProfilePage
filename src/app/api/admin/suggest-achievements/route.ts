import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isUnauthorizedResponse } from "@/lib/auth/server-auth";
import { suggestAchievements } from "@/lib/ai/gemini";

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (isUnauthorizedResponse(authResult)) {
      return authResult;
    }

    const body = await request.json();
    const { role, company, description } = body;

    if (!role || typeof role !== "string") {
      return NextResponse.json(
        { error: "Role is required" },
        { status: 400 }
      );
    }

    if (!company || typeof company !== "string") {
      return NextResponse.json(
        { error: "Company is required" },
        { status: 400 }
      );
    }

    const achievements = await suggestAchievements(role, company, description || "");

    return NextResponse.json({ achievements });
  } catch (error) {
    console.error("Achievement suggestion error:", error);
    return NextResponse.json(
      { error: "Failed to suggest achievements" },
      { status: 500 }
    );
  }
}
