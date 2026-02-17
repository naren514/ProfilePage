import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isUnauthorizedResponse } from "@/lib/auth/server-auth";
import { db } from "@/lib/db";
import { certifications } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { syncEntityToRAG, regenerateProfessionalSummary } from "@/lib/rag/sync";
import { certificationSchema, validateInput } from "@/lib/validations/api-schemas";

export async function GET() {
  try {
    const authResult = await requireAuth();
    if (isUnauthorizedResponse(authResult)) {
      return authResult;
    }

    const certList = await db
      .select()
      .from(certifications)
      .orderBy(desc(certifications.publishedDate));

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

    const validation = validateInput(certificationSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const data = validation.data;

    const [newCertification] = await db
      .insert(certifications)
      .values({
        articleTitle: data.articleTitle,
        source: data.source,
        excerpt: data.excerpt || null,
        articleUrl: data.articleUrl || null,
        publishedDate: data.publishedDate,
        followUpDate: data.followUpDate || null,
        coverImageUrl: data.coverImageUrl || null,
        isPublished: data.isPublished ?? true,
        sortOrder: data.sortOrder || 0,
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
