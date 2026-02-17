import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isUnauthorizedResponse } from "@/lib/auth/server-auth";
import { db } from "@/lib/db";
import { skills } from "@/lib/db/schema";
import { asc } from "drizzle-orm";
import { syncEntityToRAG, regenerateProfessionalSummary } from "@/lib/rag/sync";

export async function GET() {
  try {
    const authResult = await requireAuth();
    if (isUnauthorizedResponse(authResult)) {
      return authResult;
    }

    const skillList = await db
      .select()
      .from(skills)
      .orderBy(asc(skills.category), asc(skills.sortOrder));

    return NextResponse.json(skillList);
  } catch (error) {
    console.error("Get skills error:", error);
    return NextResponse.json(
      { error: "Failed to get skills" },
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

    const [newSkill] = await db
      .insert(skills)
      .values({
        name: body.name,
        category: body.category,
        proficiency: body.proficiency || 80,
        yearsExperience: body.yearsExperience || null,
        iconName: body.iconName || null,
        sortOrder: body.sortOrder || 0,
      })
      .returning();

    // Sync to RAG (non-blocking)
    syncEntityToRAG("skill", newSkill)
      .then(() => regenerateProfessionalSummary())
      .catch((err) => console.error("RAG sync failed for skill:", err));

    return NextResponse.json(newSkill);
  } catch (error) {
    console.error("Create skill error:", error);
    return NextResponse.json(
      { error: "Failed to create skill" },
      { status: 500 }
    );
  }
}
