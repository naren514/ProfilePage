import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, isUnauthorizedResponse, type ServerUser } from "@/lib/auth/server-auth";
import { apiError, isMissingTable, validationError } from "@/lib/http/errors";
import { InvalidDocumentError } from "./content";
import type { Failure } from "./documents";

const editorJsonSchema = z
  .object({ type: z.literal("doc"), content: z.array(z.unknown()).optional() })
  .passthrough()
  .refine((doc) => JSON.stringify(doc).length <= 3_000_000, "Document is too large");

export const saveDocumentSchema = z.object({
  baseRevision: z.number().int().min(1),
  title: z.string().max(200).optional(),
  excerpt: z.string().max(1000).optional(),
  slug: z
    .string()
    .trim()
    .max(255)
    .regex(/^([a-z0-9]+(?:-[a-z0-9]+)*)?$/, "Slug must be lowercase letters, numbers and single hyphens")
    .nullable()
    .optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
  postDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
  bodyJson: editorJsonSchema.optional(),
  styleId: z.string().uuid().nullable().optional(),
  snapshot: z.enum(["manual", "ai_accept"]).optional(),
});

export const baseRevisionSchema = z.object({ baseRevision: z.number().int().min(1) });

export const restoreSchema = baseRevisionSchema.extend({ revisionId: z.string().uuid() });

export const publishSchema = baseRevisionSchema.extend({
  idempotencyKey: z.string().min(8).max(100),
  confirmSlugChange: z.boolean().optional(),
});

export const idSchema = z.string().uuid();

/** Auth, setup detection and error mapping for every Writing Studio route. */
export async function writingRoute(handler: (user: ServerUser) => Promise<Response>): Promise<Response> {
  try {
    const user = await requireAuth();
    if (isUnauthorizedResponse(user)) return user;
    return await handler(user);
  } catch (error) {
    if (isMissingTable(error)) {
      return apiError("SETUP_REQUIRED", "The Writing Studio database tables haven't been created yet.", 503);
    }
    if (error instanceof InvalidDocumentError) {
      return apiError("VALIDATION_FAILED", `The document couldn't be read: ${error.message}`, 400);
    }
    console.error("Writing Studio error:", error);
    return apiError("INTERNAL", "Something went wrong in the Writing Studio.", 500);
  }
}

export async function parseBody<T extends z.ZodTypeAny>(
  request: Request,
  schema: T
): Promise<{ data: z.infer<T> } | { error: Response }> {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  return parsed.success ? { data: parsed.data } : { error: validationError(parsed.error) };
}

export function failureResponse(failure: Failure): Response {
  switch (failure.reason) {
    case "not_found":
      return apiError("NOT_FOUND", "This document doesn't exist (it may have been deleted).", 404);
    case "conflict":
      return apiError(
        "EDIT_CONFLICT",
        "This document was saved somewhere else (another tab or device) since you loaded it.",
        409,
        { currentRevision: failure.currentRevision }
      );
    case "invalid":
      return apiError("PUBLISH_INVALID", failure.problems.join(" "), 422, { problems: failure.problems });
    case "slug_locked":
      return apiError(
        "SLUG_LOCKED",
        "This post is live, so changing its URL would break links people have shared. Confirm the URL change to publish.",
        409
      );
    case "slug_taken":
      return apiError("SLUG_TAKEN", "Another post already uses this URL slug. Choose a different one.", 409);
    case "published":
      return apiError("PUBLISHED_DELETE", "Unpublish this post before deleting it.", 409);
  }
}

export function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}
