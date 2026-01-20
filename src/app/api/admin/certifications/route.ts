import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isUnauthorizedResponse } from "@/lib/firebase/server-auth";
import { db } from "@/lib/db";
import { certifications } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { syncEntityToRAG, regenerateProfessionalSummary } from "@/lib/rag/sync";

export async function GET() {
  try {
    const authResult = await requireAuth();
    if (isUnauthorizedResponse(authResult)) {
      return authResult;
    }

    const certList = await db
      .select()
      .from(certifications)
      .orderBy(desc(certifications.issueDate));

    return NextResponse.json(certList);
  } catch (error) {
    console.error("Get certifications error:", error);
    return NextResponse.json(
      { error: "Failed to get certifications" },
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

    const [newCertification] = await db
      .insert(certifications)
      .values({
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
      .returning();

    // Sync to RAG (non-blocking)
    syncEntityToRAG("certification", newCertification)
      .then(() => regenerateProfessionalSummary())
      .catch((err) => console.error("RAG sync failed for certification:", err));

    return NextResponse.json(newCertification);
  } catch (error) {
    console.error("Create certification error:", error);
    return NextResponse.json(
      { error: "Failed to create certification" },
      { status: 500 }
    );
  }
}
