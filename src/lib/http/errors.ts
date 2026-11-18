import { NextResponse } from "next/server";
import type { ZodError } from "zod";

export type ApiErrorCode =
  | "VALIDATION_FAILED"
  | "NOT_FOUND"
  | "SLUG_TAKEN"
  | "SLUG_LOCKED"
  | "EDIT_CONFLICT"
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

/** Postgres unique_violation, as surfaced by the Neon driver. */
export function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; current && depth < 4; depth++) {
    if (typeof current === "object" && (current as { code?: string }).code === "23505") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}
