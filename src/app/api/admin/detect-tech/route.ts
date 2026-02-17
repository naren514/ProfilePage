import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isUnauthorizedResponse } from "@/lib/auth/server-auth";
import { detectTechnologies } from "@/lib/ai/gemini";

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (isUnauthorizedResponse(authResult)) {
      return authResult;
    }

    const body = await request.json();
    const { description } = body;

    if (!description || typeof description !== "string") {
      return NextResponse.json(
        { error: "Description is required" },
        { status: 400 }
      );
    }

    if (description.length < 20) {
      return NextResponse.json(
        { error: "Description is too short" },
        { status: 400 }
      );
    }

    const technologies = await detectTechnologies(description);

    return NextResponse.json({ technologies });
  } catch (error) {
    console.error("Tech detection error:", error);
    return NextResponse.json(
      { error: "Failed to detect technologies" },
      { status: 500 }
    );
  }
}
