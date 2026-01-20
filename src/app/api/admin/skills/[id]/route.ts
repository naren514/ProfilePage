import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isUnauthorizedResponse } from "@/lib/firebase/server-auth";
import { db } from "@/lib/db";
import { skills } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { syncEntityToRAG, removeEntityFromRAG, regenerateProfessionalSummary } from "@/lib/rag/sync";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth();
    if (isUnauthorizedResponse(authResult)) {
      return authResult;
    }

    const { id } = await params;

    const [skill] = await db
      .select()
      .from(skills)
      .where(eq(skills.id, id));

    if (!skill) {
      return NextResponse.json({ error: "Skill not found" }, { status: 404 });
    }

    return NextResponse.json(skill);
  } catch (error) {
    console.error("Get skill error:", error);
    return NextResponse.json(
      { error: "Failed to get skill" },
      { status: 500 }
    );
  }
}

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
      .update(skills)
      .set({
        name: body.name,
        category: body.category,
        proficiency: body.proficiency || 80,
        yearsExperience: body.yearsExperience || null,
        iconName: body.iconName || null,
        sortOrder: body.sortOrder || 0,
      })
      .where(eq(skills.id, id))
      .returning();

    // Sync to RAG (non-blocking)
    syncEntityToRAG("skill", updated)
      .then(() => regenerateProfessionalSummary())
      .catch((err) => console.error("RAG sync failed for skill:", err));

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update skill error:", error);
    return NextResponse.json(
      { error: "Failed to update skill" },
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

    await db.delete(skills).where(eq(skills.id, id));

    // Remove from RAG (non-blocking)
    removeEntityFromRAG("skill", id)
      .then(() => regenerateProfessionalSummary())
      .catch((err) => console.error("RAG removal failed for skill:", err));

    return NextResponse.json({ message: "Skill deleted" });
  } catch (error) {
    console.error("Delete skill error:", error);
    return NextResponse.json(
      { error: "Failed to delete skill" },
      { status: 500 }
    );
  }
}
