import { z } from "zod";
import { apiError, isMissingTable } from "@/lib/http/errors";
import { requireAuth, isUnauthorizedResponse, type ServerUser } from "@/lib/auth/server-auth";
import { ReadingInputError } from "./items";

const text = (max: number) => z.string().max(max).nullable().optional();

/** What the iPhone Shortcut (or any client with a token) sends. */
export const tokenSaveSchema = z.object({
  url: text(2000),
  title: text(500),
  text: text(5000),
  note: text(600),
  quote: text(2000),
  publish: z.union([z.boolean(), z.enum(["true", "false", "Publish now", "Keep private"])]).optional(),
});

export { wantsPublish } from "./rules";

export const adminSaveSchema = z.object({
  url: z.string().min(1).max(2000),
  title: text(500),
  titleOverride: text(300),
  text: text(5000),
  quote: text(2000),
  note: text(600),
  suggestedNote: text(600),
  publish: z.boolean().optional(),
  via: z.enum(["admin", "bookmarklet"]).default("admin"),
  suggest: z.boolean().optional(),
});

export const previewSchema = z.object({
  url: z.string().min(1).max(2000),
  title: text(500),
  text: text(5000),
  quote: text(2000),
});

export const patchSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  source: z.string().trim().min(1).max(200).optional(),
  note: text(600),
  quote: text(2000),
  suggestedNote: text(600),
  status: z.enum(["inbox", "published", "archived"]).optional(),
});

export const tokenCreateSchema = z.object({ name: z.string().trim().min(1).max(80).default("iPhone Shortcut") });

export function readingSetupRequired() {
  return apiError("SETUP_REQUIRED", "The reading list needs a one-time database update. Open Admin → Reading and choose Set up now.", 503);
}

/** Admin auth plus error mapping for the reading-list routes. */
export async function readingRoute(handler: (user: ServerUser) => Promise<Response>): Promise<Response> {
  try {
    const user = await requireAuth();
    if (isUnauthorizedResponse(user)) return user;
    return await handler(user);
  } catch (error) {
    return readingError(error);
  }
}

export function readingError(error: unknown): Response {
  if (error instanceof ReadingInputError) return apiError("VALIDATION_FAILED", error.message, 400);
  if (isMissingTable(error)) return readingSetupRequired();
  console.error("Reading list error:", error);
  return apiError("INTERNAL", "Something went wrong with the reading list.", 500);
}
