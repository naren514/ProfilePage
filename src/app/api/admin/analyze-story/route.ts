import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isUnauthorizedResponse } from "@/lib/firebase/server-auth";
import { chatModel } from "@/lib/ai/gemini";

export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if (isUnauthorizedResponse(authResult)) {
    return authResult;
  }

  try {
    const { content } = await request.json();

    if (!content || typeof content !== "string") {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

    const prompt = `Analyze the following text and extract information to populate a professional story in STAR format. The story should be suitable for a portfolio/resume context.

Text to analyze:
"""
${content}
"""

Extract and return a JSON object with these fields:
{
  "title": "A concise, compelling title for this story (5-10 words)",
  "summary": "A 2-3 sentence summary of the story",
  "company": "The company name if mentioned, otherwise empty string",
  "role": "The role/position if mentioned, otherwise empty string",
  "situation": "The context, background, or challenge that existed (2-4 sentences)",
  "task": "The specific objective, goal, or responsibility assigned (2-3 sentences)",
  "action": "The concrete steps and actions taken to address the situation (3-5 sentences)",
  "result": "The measurable outcomes, impact, or achievements (2-4 sentences with metrics if available)",
  "lessonsLearned": "Key insights, takeaways, or skills developed (2-3 sentences)",
  "tags": ["array", "of", "relevant", "tags", "like", "leadership", "cloud", "problem-solving"]
}

Guidelines:
- Write in first person where appropriate
- Be specific and professional
- Include metrics and numbers when mentioned in the text
- If certain fields cannot be determined from the text, provide reasonable professional content based on context
- Tags should be relevant skills, technologies, or themes (5-8 tags)

Return ONLY the JSON object, no additional text.`;

    const result = await chatModel.generateContent(prompt);
    const response = result.response.text();

    // Extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Failed to parse AI response");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Analyze story error:", error);
    return NextResponse.json(
      { error: "Failed to analyze content" },
      { status: 500 }
    );
  }
}
