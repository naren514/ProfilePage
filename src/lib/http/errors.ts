import { NextResponse } from "next/server";
import type { ZodError } from "zod";

export type ApiErrorCode =
  | "VALIDATION_FAILED"
  | "NOT_FOUND"
  | "SLUG_TAKEN"
  | "SLUG_LOCKED"
  | "EDIT_CONFLICT"
  | "PUBLISH_INVALID"
  | "PUBLISHED_DELETE"
  | "SETUP_REQUIRED"
  | "UNSUPPORTED_MEDIA"
  | "AI_DISABLED"
  | "AI_BUDGET_EXCEEDED"
  | "AI_PROVIDER_ERROR"
  | "INTERNAL";

export function apiError(code: ApiErrorCode, message: string, status: number, details?: unknown) {
  return NextResponse.json({ error: message, code, ...(details ? { details } : {}) }, { status });
}

export function validationError(error: ZodError) {
  const first = error.issues[0];
  const field = first?.path.join(".");
  const message = first ? `${field ? `${field}: ` : ""}${first.message}` : "Invalid request";
  return apiError("VALIDATION_FAILED", message, 400, error.issues);
}

interface PgErrorInfo {
  code?: string;
  constraint?: string;
}

/** The Postgres error code and constraint, looking through drizzle's error wrappers. */
export function pgErrorInfo(error: unknown): PgErrorInfo {
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth++) {
    if (typeof current === "object") {
      const { code, constraint } = current as PgErrorInfo;
      if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) return { code, constraint };
    }
    current = (current as { cause?: unknown }).cause;
  }
  return {};
}

/** Postgres unique_violation, as surfaced by the Neon driver. */
export function isUniqueViolation(error: unknown): boolean {
  return pgErrorInfo(error).code === "23505";
}

/** A table or column doesn't exist yet (Writing Studio setup needs to run). */
export function isMissingTable(error: unknown): boolean {
  const { code } = pgErrorInfo(error);
  return code === "42P01" || code === "42703";
}
