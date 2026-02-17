import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isUnauthorizedResponse } from "@/lib/auth/server-auth";
import { db } from "@/lib/db";
import { volunteerWork } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { syncEntityToRAG, regenerateProfessionalSummary } from "@/lib/rag/sync";

export async function GET() {
  try {
    const authResult = await requireAuth();
    if (isUnauthorizedResponse(authResult)) {
      return authResult;
    }

    const volunteerList = await db
      .select()
      .from(volunteerWork)
      .orderBy(desc(volunteerWork.createdAt));

    return NextResponse.json(volunteerList);
  } catch (error) {
    console.error("Get volunteer work error:", error);
    return NextResponse.json(
      { error: "Failed to get volunteer work" },
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

    const [newVolunteer] = await db
      .insert(volunteerWork)
      .values({
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
      })
      .returning();

    // Sync to RAG (non-blocking)
    syncEntityToRAG("volunteer", newVolunteer)
      .then(() => regenerateProfessionalSummary())
      .catch((err) => console.error("RAG sync failed for volunteer:", err));

    return NextResponse.json(newVolunteer);
  } catch (error) {
    console.error("Create volunteer work error:", error);
    return NextResponse.json(
      { error: "Failed to create volunteer work" },
      { status: 500 }
    );
  }
}
