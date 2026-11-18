import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isUnauthorizedResponse } from "@/lib/auth/server-auth";
import { db } from "@/lib/db";
import { stories } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { syncEntityToRAG, regenerateProfessionalSummary } from "@/lib/rag/sync";
import { thoughtSchema } from "@/lib/validations/api-schemas";
import { sanitizePostHtml } from "@/lib/content/sanitize";
import { apiError, isUniqueViolation, validationError } from "@/lib/http/errors";

export async function GET() {
  try {
    const authResult = await requireAuth();
    if (isUnauthorizedResponse(authResult)) {
      return authResult;
    }

    const storyList = await db
      .select()
      .from(stories)
      .orderBy(desc(stories.createdAt));

    return NextResponse.json(storyList);
  } catch (error) {
    console.error("Get stories error:", error);
    return apiError("INTERNAL", "Failed to get stories", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (isUnauthorizedResponse(authResult)) {
      return authResult;
    }

    const parsed = thoughtSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return validationError(parsed.error);
    const body = parsed.data;

    const [newStory] = await db
      .insert(stories)
      .values({
        title: body.title,
        slug: body.slug,
        summary: body.summary,
        situation: body.situation || null,
        task: body.task || null,
        action: body.action ? sanitizePostHtml(body.action) : null,
        result: body.result || null,
        lessonsLearned: body.lessonsLearned || null,
        company: body.company || null,
        role: body.role || null,
        date: body.date || null,
        tags: body.tags,
        isFeatured: body.isFeatured,
        isPublished: body.isPublished,
      })
      .returning();

    // Sync to RAG (non-blocking); drafts are skipped inside syncEntityToRAG
    syncEntityToRAG("story", newStory)
      .then(() => regenerateProfessionalSummary())
      .catch((err) => console.error("RAG sync failed for story:", err));

    return NextResponse.json(newStory);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return apiError("SLUG_TAKEN", "Another post already uses this URL slug. Choose a different one.", 409);
    }
    console.error("Create story error:", error);
    return apiError("INTERNAL", "Failed to create story", 500);
  }
}
