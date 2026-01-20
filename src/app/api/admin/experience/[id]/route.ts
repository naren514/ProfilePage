import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isUnauthorizedResponse } from "@/lib/firebase/server-auth";
import { db } from "@/lib/db";
import { experiences } from "@/lib/db/schema";
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
      .update(experiences)
      .set({
        company: body.company,
        title: body.title,
        location: body.location || null,
        employmentType: body.employmentType || "full-time",
        startDate: body.startDate,
        endDate: body.endDate || null,
        isCurrent: body.isCurrent || false,
        description: body.description || null,
        achievements: body.achievements || [],
        technologies: body.technologies || [],
        updatedAt: new Date(),
      })
      .where(eq(experiences.id, id))
      .returning();

    // Sync to RAG (non-blocking)
    syncEntityToRAG("experience", updated)
      .then(() => regenerateProfessionalSummary())
      .catch((err) => console.error("RAG sync failed for experience:", err));

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update experience error:", error);
    return NextResponse.json(
      { error: "Failed to update experience" },
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

    await db.delete(experiences).where(eq(experiences.id, id));

    // Remove from RAG (non-blocking)
    removeEntityFromRAG("experience", id)
      .then(() => regenerateProfessionalSummary())
      .catch((err) => console.error("RAG removal failed for experience:", err));

    return NextResponse.json({ message: "Experience deleted" });
  } catch (error) {
    console.error("Delete experience error:", error);
    return NextResponse.json(
      { error: "Failed to delete experience" },
      { status: 500 }
    );
  }
}
