import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isUnauthorizedResponse } from "@/lib/firebase/server-auth";
import { generateSTARContent } from "@/lib/ai/gemini";

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (isUnauthorizedResponse(authResult)) {
      return authResult;
    }

    const body = await request.json();
    const { rawNotes, targetField } = body;

    if (!rawNotes || typeof rawNotes !== "string") {
      return NextResponse.json(
        { error: "Raw notes are required" },
        { status: 400 }
      );
    }

    if (!targetField || !["situation", "task", "action", "result", "lessonsLearned"].includes(targetField)) {
      return NextResponse.json(
        { error: "Valid target field is required (situation, task, action, result, lessonsLearned)" },
        { status: 400 }
      );
    }

    const generatedContent = await generateSTARContent(rawNotes, targetField);

    return NextResponse.json({ content: generatedContent });
  } catch (error) {
    console.error("AI assist error:", error);
    return NextResponse.json(
      { error: "Failed to generate content" },
      { status: 500 }
    );
  }
}
