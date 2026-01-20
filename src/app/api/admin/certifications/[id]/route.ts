import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isUnauthorizedResponse } from "@/lib/firebase/server-auth";
import { db } from "@/lib/db";
import { certifications } from "@/lib/db/schema";
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

    const [certification] = await db
      .select()
      .from(certifications)
      .where(eq(certifications.id, id));

    if (!certification) {
      return NextResponse.json({ error: "Certification not found" }, { status: 404 });
    }

    return NextResponse.json(certification);
  } catch (error) {
    console.error("Get certification error:", error);
    return NextResponse.json(
      { error: "Failed to get certification" },
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
      .update(certifications)
      .set({
        name: body.name,
        issuer: body.issuer,
        credentialId: body.credentialId || null,
        credentialUrl: body.credentialUrl || null,
        issueDate: body.issueDate,
        expirationDate: body.expirationDate || null,
        badgeUrl: body.badgeUrl || null,
        isActive: body.isActive ?? true,
        sortOrder: body.sortOrder || 0,
      })
      .where(eq(certifications.id, id))
      .returning();

    // Sync to RAG (non-blocking)
    syncEntityToRAG("certification", updated)
      .then(() => regenerateProfessionalSummary())
      .catch((err) => console.error("RAG sync failed for certification:", err));

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update certification error:", error);
    return NextResponse.json(
      { error: "Failed to update certification" },
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

    await db.delete(certifications).where(eq(certifications.id, id));

    // Remove from RAG (non-blocking)
    removeEntityFromRAG("certification", id)
      .then(() => regenerateProfessionalSummary())
      .catch((err) => console.error("RAG removal failed for certification:", err));

    return NextResponse.json({ message: "Certification deleted" });
  } catch (error) {
    console.error("Delete certification error:", error);
    return NextResponse.json(
      { error: "Failed to delete certification" },
      { status: 500 }
    );
  }
}
