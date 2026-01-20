import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isUnauthorizedResponse } from "@/lib/firebase/server-auth";
import { db } from "@/lib/db";
import { experiences } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { syncEntityToRAG, regenerateProfessionalSummary } from "@/lib/rag/sync";

export async function GET() {
  try {
    const authResult = await requireAuth();
    if (isUnauthorizedResponse(authResult)) {
      return authResult;
    }

    const expList = await db
      .select()
      .from(experiences)
      .orderBy(desc(experiences.isCurrent), desc(experiences.startDate));

    return NextResponse.json(expList);
  } catch (error) {
    console.error("Get experiences error:", error);
    return NextResponse.json(
      { error: "Failed to get experiences" },
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

    const [newExperience] = await db
      .insert(experiences)
      .values({
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
      })
      .returning();

    // Sync to RAG (non-blocking)
    syncEntityToRAG("experience", newExperience)
      .then(() => regenerateProfessionalSummary())
      .catch((err) => console.error("RAG sync failed for experience:", err));

    return NextResponse.json(newExperience);
  } catch (error) {
    console.error("Create experience error:", error);
    return NextResponse.json(
      { error: "Failed to create experience" },
      { status: 500 }
    );
  }
}
