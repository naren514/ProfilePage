import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isUnauthorizedResponse } from "@/lib/auth/server-auth";
import { generateSummaryFromSTAR } from "@/lib/ai/gemini";

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (isUnauthorizedResponse(authResult)) {
      return authResult;
    }

    const body = await request.json();
    const { situation, task, action, result } = body;

    // Ensure at least one field is provided
    if (!situation && !task && !action && !result) {
      return NextResponse.json(
        { error: "At least one STAR field is required" },
        { status: 400 }
      );
    }

    const summary = await generateSummaryFromSTAR({
      situation,
      task,
      action,
      result,
    });

    return NextResponse.json({ summary });
  } catch (error) {
    console.error("Generate summary error:", error);
    return NextResponse.json(
      { error: "Failed to generate summary" },
      { status: 500 }
    );
  }
}
