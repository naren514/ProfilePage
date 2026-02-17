import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isUnauthorizedResponse } from "@/lib/auth/server-auth";
import { db } from "@/lib/db";
import { experiences } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { syncEntityToRAG, regenerateProfessionalSummary } from "@/lib/rag/sync";
import { experienceSchema, validateInput } from "@/lib/validations/api-schemas";

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

    // Validate input with Zod
    const validation = validateInput(experienceSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const data = validation.data;

    const [newExperience] = await db
      .insert(experiences)
      .values({
        company: data.company,
        title: data.title,
        location: data.location || null,
        employmentType: data.employmentType,
        startDate: data.startDate,
        endDate: data.endDate || null,
        isCurrent: data.isCurrent,
        description: data.description || null,
        achievements: data.achievements,
        technologies: data.technologies,
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
