import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isUnauthorizedResponse } from "@/lib/auth/server-auth";
import { db } from "@/lib/db";
import { stories } from "@/lib/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { syncEntityToRAG, removeEntityFromRAG, regenerateProfessionalSummary } from "@/lib/rag/sync";
import { thoughtUpdateSchema, uuidSchema } from "@/lib/validations/api-schemas";
import { buildThoughtUpdate, isBlockedSlugChange } from "@/lib/content/thought-update";
import { apiError, isUniqueViolation, validationError } from "@/lib/http/errors";

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
    if (!uuidSchema.safeParse(id).success) return apiError("NOT_FOUND", "Post not found", 404);

    const parsed = thoughtUpdateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return validationError(parsed.error);
    const input = parsed.data;

    const [existing] = await db
      .select({ slug: stories.slug, isPublished: stories.isPublished })
      .from(stories)
      .where(eq(stories.id, id))
      .limit(1);
    if (!existing) return apiError("NOT_FOUND", "Post not found", 404);

    if (isBlockedSlugChange(existing, input)) {
      return apiError(
        "SLUG_LOCKED",
        "This post is published, so changing its URL would break existing links. Confirm the URL change to proceed.",
        409
      );
    }

    // Optimistic concurrency: only write if nobody saved since the client loaded
    // the post. Postgres keeps microseconds and JS dates keep milliseconds, so
    // compare within a 1 ms window.
    const conditions = [eq(stories.id, id)];
    if (input.expectedUpdatedAt) {
      const expected = new Date(input.expectedUpdatedAt).toISOString();
      conditions.push(
        sql`abs(extract(epoch from (${stories.updatedAt} - (${expected}::timestamptz at time zone 'UTC')))) < 0.001`
      );
    }

    const [updated] = await db
      .update(stories)
      .set({ ...buildThoughtUpdate(input), updatedAt: new Date() })
      .where(and(...conditions))
      .returning();

    if (!updated) {
      return apiError(
        "EDIT_CONFLICT",
        "This post was changed somewhere else since you opened it. Reload to see the latest version before saving.",
        409
      );
    }

    // Sync to RAG (non-blocking); unpublished posts are removed instead
    syncEntityToRAG("story", updated)
      .then(() => regenerateProfessionalSummary())
      .catch((err) => console.error("RAG sync failed for story:", err));

    return NextResponse.json(updated);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return apiError("SLUG_TAKEN", "Another post already uses this URL slug. Choose a different one.", 409);
    }
    console.error("Update story error:", error);
    return apiError("INTERNAL", "Failed to update story", 500);
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
    if (!uuidSchema.safeParse(id).success) return apiError("NOT_FOUND", "Post not found", 404);

    await db.delete(stories).where(eq(stories.id, id));

    // Remove from RAG (non-blocking)
    removeEntityFromRAG("story", id)
      .then(() => regenerateProfessionalSummary())
      .catch((err) => console.error("RAG removal failed for story:", err));

    return NextResponse.json({ message: "Story deleted" });
  } catch (error) {
    console.error("Delete story error:", error);
    return apiError("INTERNAL", "Failed to delete story", 500);
  }
}
