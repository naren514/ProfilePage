import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isUnauthorizedResponse } from "@/lib/auth/server-auth";
import { db } from "@/lib/db";
import { stories } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { syncEntityToRAG, regenerateProfessionalSummary } from "@/lib/rag/sync";

export async function GET() {
  try {
    const authResult = await requireAuth();
    if (isUnauthorizedResponse(authResult)) {
      return authResult;
    }

    const storyList = await db
      .select()
      .from(stories)
      .orderBy(desc(stories.createdAt));

    return NextResponse.json(storyList);
  } catch (error) {
    console.error("Get stories error:", error);
    return NextResponse.json(
      { error: "Failed to get stories" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (isUnauthorizedResponse(authResult)) {
      return authResult;
    }

    const body = await request.json();

    const [newStory] = await db
      .insert(stories)
      .values({
        title: body.title,
        slug: body.slug,
        summary: body.summary,
        situation: body.situation || null,
        task: body.task || null,
        action: body.action || null,
        result: body.result || null,
        lessonsLearned: body.lessonsLearned || null,
        company: body.company || null,
        role: body.role || null,
        date: body.date || null,
        tags: body.tags || [],
        isFeatured: body.isFeatured || false,
        isPublished: body.isPublished || false,
      })
      .returning();

    // Sync to RAG (non-blocking)
    syncEntityToRAG("story", newStory)
      .then(() => regenerateProfessionalSummary())
      .catch((err) => console.error("RAG sync failed for story:", err));

    return NextResponse.json(newStory);
  } catch (error) {
    console.error("Create story error:", error);
    return NextResponse.json(
      { error: "Failed to create story" },
      { status: 500 }
    );
  }
}
