import crypto from "crypto";

// Pure token helpers (no I/O), unit tested.

export const READING_SCOPE = "reading:save";
const PREFIX = "rd_";

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function generateToken(): string {
  return PREFIX + crypto.randomBytes(24).toString("base64url");
}

/** The token from an `Authorization: Bearer …` header, if it looks like one of ours. */
export function bearerToken(header: string | null): string | null {
  const match = header?.match(/^Bearer\s+(\S+)$/i);
  const token = match?.[1] ?? null;
  return token && token.startsWith(PREFIX) && token.length <= 100 ? token : null;
}
