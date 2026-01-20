import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isUnauthorizedResponse } from "@/lib/firebase/server-auth";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
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
      .update(projects)
      .set({
        title: body.title,
        slug: body.slug,
        summary: body.summary,
        websiteUrl: body.websiteUrl || null,
        thumbnailUrl: body.thumbnailUrl || null,
        situation: body.situation || null,
        task: body.task || null,
        action: body.action || null,
        result: body.result || null,
        lessonsLearned: body.lessonsLearned || null,
        technologies: body.technologies || [],
        company: body.company || null,
        role: body.role || null,
        startDate: body.startDate || null,
        endDate: body.endDate || null,
        isFeatured: body.isFeatured || false,
        isPublished: body.isPublished || false,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, id))
      .returning();

    // Sync to RAG (non-blocking)
    syncEntityToRAG("project", updated)
      .then(() => regenerateProfessionalSummary())
      .catch((err) => console.error("RAG sync failed for project:", err));

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update project error:", error);
    return NextResponse.json(
      { error: "Failed to update project" },
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

    await db.delete(projects).where(eq(projects.id, id));

    // Remove from RAG (non-blocking)
    removeEntityFromRAG("project", id)
      .then(() => regenerateProfessionalSummary())
      .catch((err) => console.error("RAG removal failed for project:", err));

    return NextResponse.json({ message: "Project deleted" });
  } catch (error) {
    console.error("Delete project error:", error);
    return NextResponse.json(
      { error: "Failed to delete project" },
      { status: 500 }
    );
  }
}
