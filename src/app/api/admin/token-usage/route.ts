import { NextResponse } from "next/server";
import { requireAuth, isUnauthorizedResponse } from "@/lib/auth/server-auth";
import { db } from "@/lib/db";
import { tokenUsage } from "@/lib/db/schema";
import { desc, sql } from "drizzle-orm";

// GET - View token usage breakdown
export async function GET() {
  const authResult = await requireAuth();
  if (isUnauthorizedResponse(authResult)) {
    return authResult;
  }

  try {
    // Get all token usage records
    const records = await db
      .select()
      .from(tokenUsage)
      .orderBy(desc(tokenUsage.date));

    // Get totals
    const totals = await db
      .select({
        totalPromptTokens: sql<number>`COALESCE(SUM(${tokenUsage.promptTokens}), 0)`,
        totalCompletionTokens: sql<number>`COALESCE(SUM(${tokenUsage.completionTokens}), 0)`,
        totalRequests: sql<number>`COALESCE(SUM(${tokenUsage.requestCount}), 0)`,
      })
      .from(tokenUsage);

    return NextResponse.json({
      records,
      totals: {
        promptTokens: totals[0]?.totalPromptTokens || 0,
        completionTokens: totals[0]?.totalCompletionTokens || 0,
        totalTokens: (totals[0]?.totalPromptTokens || 0) + (totals[0]?.totalCompletionTokens || 0),
        totalRequests: totals[0]?.totalRequests || 0,
      },
    });
  } catch (error) {
    console.error("Error fetching token usage:", error);
    return NextResponse.json(
      { error: "Failed to fetch token usage" },
      { status: 500 }
    );
  }
}

// DELETE - Reset token usage (clear all records)
export async function DELETE() {
  const authResult = await requireAuth();
  if (isUnauthorizedResponse(authResult)) {
    return authResult;
  }

  try {
    // Clear all token usage records
    await db.delete(tokenUsage);

    return NextResponse.json({ message: "Token usage reset successfully" });
  } catch (error) {
    console.error("Error resetting token usage:", error);
    return NextResponse.json(
      { error: "Failed to reset token usage" },
      { status: 500 }
    );
  }
}
