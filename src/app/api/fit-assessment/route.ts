import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tokenUsage } from "@/lib/db/schema";
import { sql } from "drizzle-orm";
import { generateFitAssessment } from "@/lib/ai/gemini";
import { retrieveSimilarChunks, formatContextFromChunks } from "@/lib/rag/retriever";
import { withRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export const POST = withRateLimit(RATE_LIMITS.fitAssessment, async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { jobDescription } = body;

    if (!jobDescription || typeof jobDescription !== "string") {
      return NextResponse.json(
        { error: "Job description is required" },
        { status: 400 }
      );
    }

    if (jobDescription.length < 50) {
      return NextResponse.json(
        { error: "Job description is too short. Please provide more details." },
        { status: 400 }
      );
    }

    // Retrieve relevant context from the knowledge base
    // Lower threshold since text-embedding-004 similarity scores typically range 0.4-0.6
    const relevantChunks = await retrieveSimilarChunks(jobDescription, {
      topK: 10,
      threshold: 0.4,
    });

    const context = formatContextFromChunks(relevantChunks);

    // Generate fit assessment
    const assessment = await generateFitAssessment(jobDescription, context);

    // Track token usage
    const today = new Date().toISOString().split("T")[0];
    const promptTokens = Math.ceil((jobDescription.length + context.length) / 4);
    const completionTokens = Math.ceil(JSON.stringify(assessment).length / 4);

    await db
      .insert(tokenUsage)
      .values({
        date: today,
        model: "gemini-2.0-flash-exp",
        operation: "fit-assessment",
        promptTokens,
        completionTokens,
        requestCount: 1,
      })
      .onConflictDoUpdate({
        target: [tokenUsage.date, tokenUsage.model, tokenUsage.operation],
        set: {
          promptTokens: sql`${tokenUsage.promptTokens} + ${promptTokens}`,
          completionTokens: sql`${tokenUsage.completionTokens} + ${completionTokens}`,
          requestCount: sql`${tokenUsage.requestCount} + 1`,
        },
      });

    return NextResponse.json(assessment);
  } catch (error) {
    console.error("Fit assessment error:", error);
    return NextResponse.json(
      { error: "Failed to generate fit assessment" },
      { status: 500 }
    );
  }
});
