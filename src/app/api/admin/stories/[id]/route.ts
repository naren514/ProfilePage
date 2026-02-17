import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isUnauthorizedResponse } from "@/lib/auth/server-auth";
import { db } from "@/lib/db";
import { stories } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { syncEntityToRAG, removeEntityFromRAG, regenerateProfessionalSummary } from "@/lib/rag/sync";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth();
    if (isUnauthorizedResponse(authResult)) {
      return authResult;
    }

    const { id } = await params;
    const body = await request.json();

    const [updated] = await db
      .update(stories)
      .set({
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
        updatedAt: new Date(),
      })
      .where(eq(stories.id, id))
      .returning();

    // Sync to RAG (non-blocking)
    syncEntityToRAG("story", updated)
      .then(() => regenerateProfessionalSummary())
      .catch((err) => console.error("RAG sync failed for story:", err));

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update story error:", error);
    return NextResponse.json(
      { error: "Failed to update story" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth();
    if (isUnauthorizedResponse(authResult)) {
      return authResult;
    }

    const { id } = await params;

    await db.delete(stories).where(eq(stories.id, id));

    // Remove from RAG (non-blocking)
    removeEntityFromRAG("story", id)
      .then(() => regenerateProfessionalSummary())
      .catch((err) => console.error("RAG removal failed for story:", err));

    return NextResponse.json({ message: "Story deleted" });
  } catch (error) {
    console.error("Delete story error:", error);
    return NextResponse.json(
      { error: "Failed to delete story" },
      { status: 500 }
    );
  }
}
