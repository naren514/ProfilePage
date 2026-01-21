import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isUnauthorizedResponse } from "@/lib/firebase/server-auth";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { syncEntityToRAG, regenerateProfessionalSummary } from "@/lib/rag/sync";
import { projectSchema, validateInput } from "@/lib/validations/api-schemas";

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

    // Validate input with Zod
    const validation = validateInput(projectSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const data = validation.data;

    const [newProject] = await db
      .insert(projects)
      .values({
        title: data.title,
        slug: data.slug,
        summary: data.summary,
        websiteUrl: data.websiteUrl || null,
        thumbnailUrl: data.thumbnailUrl || null,
        situation: data.situation || null,
        task: data.task || null,
        action: data.action || null,
        result: data.result || null,
        lessonsLearned: data.lessonsLearned || null,
        technologies: data.technologies,
        company: data.company || null,
        role: data.role || null,
        startDate: data.startDate || null,
        endDate: data.endDate || null,
        isFeatured: data.isFeatured,
        isPublished: data.isPublished,
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
