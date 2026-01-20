import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isUnauthorizedResponse } from "@/lib/firebase/server-auth";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { syncEntityToRAG, regenerateProfessionalSummary } from "@/lib/rag/sync";

export async function GET() {
  try {
    const authResult = await requireAuth();
    if (isUnauthorizedResponse(authResult)) {
      return authResult;
    }

    const projectList = await db
      .select()
      .from(projects)
      .orderBy(desc(projects.createdAt));

    return NextResponse.json(projectList);
  } catch (error) {
    console.error("Get projects error:", error);
    return NextResponse.json(
      { error: "Failed to get projects" },
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

    const [newProject] = await db
      .insert(projects)
      .values({
        title: body.title,
        slug: body.slug,
        summary: body.summary,
        websiteUrl: body.websiteUrl || null,
        thumbnailUrl: body.thumbnailUrl || null,
        situation: body.situation || null,
        task: body.task || null,
        action: body.action || null,
        result: body.result || null,
        lessonsLearned: body.lessonsLearned || null,
        technologies: body.technologies || [],
        company: body.company || null,
        role: body.role || null,
        startDate: body.startDate || null,
        endDate: body.endDate || null,
        isFeatured: body.isFeatured || false,
        isPublished: body.isPublished || false,
      })
      .returning();

    // Sync to RAG (non-blocking)
    syncEntityToRAG("project", newProject)
      .then(() => regenerateProfessionalSummary())
      .catch((err) => console.error("RAG sync failed for project:", err));

    return NextResponse.json(newProject);
  } catch (error) {
    console.error("Create project error:", error);
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    );
  }
}
