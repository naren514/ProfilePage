import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isUnauthorizedResponse } from "@/lib/auth/server-auth";
import { db } from "@/lib/db";
import { volunteerWork } from "@/lib/db/schema";
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
      .update(volunteerWork)
      .set({
        organization: body.organization,
        role: body.role,
        location: body.location || null,
        cause: body.cause || null,
        description: body.description || null,
        situation: body.situation || null,
        task: body.task || null,
        action: body.action || null,
        result: body.result || null,
        startDate: body.startDate || null,
        endDate: body.endDate || null,
        isCurrent: body.isCurrent || false,
        skills: body.skills || [],
        websiteUrl: body.websiteUrl || null,
        isPublished: body.isPublished || false,
        updatedAt: new Date(),
      })
      .where(eq(volunteerWork.id, id))
      .returning();

    // Sync to RAG (non-blocking)
    syncEntityToRAG("volunteer", updated)
      .then(() => regenerateProfessionalSummary())
      .catch((err) => console.error("RAG sync failed for volunteer:", err));

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update volunteer work error:", error);
    return NextResponse.json(
      { error: "Failed to update volunteer work" },
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

    await db.delete(volunteerWork).where(eq(volunteerWork.id, id));

    // Remove from RAG (non-blocking)
    removeEntityFromRAG("volunteer", id)
      .then(() => regenerateProfessionalSummary())
      .catch((err) => console.error("RAG removal failed for volunteer:", err));

    return NextResponse.json({ message: "Volunteer work deleted" });
  } catch (error) {
    console.error("Delete volunteer work error:", error);
    return NextResponse.json(
      { error: "Failed to delete volunteer work" },
      { status: 500 }
    );
  }
}
