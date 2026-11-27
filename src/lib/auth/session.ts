import crypto from "crypto";

export interface SessionUser {
  email: string;
  name?: string;
}

interface SessionPayload {
  email: string;
  exp: number;
}

function getSessionSecret(): string | null {
  const secret = process.env.AUTH_SESSION_SECRET || process.env.ADMIN_PASSWORD;
  if (secret) return secret;
  // A well-known fallback would let anyone sign a session: only allowed in development
  return process.env.NODE_ENV === "production" ? null : "dev-session-secret";
}

function base64url(input: string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(value: string): string | null {
  const secret = getSessionSecret();
  return secret ? crypto.createHmac("sha256", secret).update(value).digest("base64url") : null;
}

export function createSessionToken(user: SessionUser, maxAgeMs: number): string {
  const payload: SessionPayload = {
    email: user.email.toLowerCase(),
    exp: Date.now() + maxAgeMs,
  };

  const encoded = base64url(JSON.stringify(payload));
  const signature = sign(encoded);
  if (!signature) throw new Error("Set AUTH_SESSION_SECRET (or ADMIN_PASSWORD) on the server to enable sign-in.");
  return `${encoded}.${signature}`;
}

export function verifySessionToken(token: string | undefined | null): SessionUser | null {
  if (!token) return null;

  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  const expected = sign(encoded);
  if (!expected) return null;
  const sigA = Buffer.from(signature);
  const sigB = Buffer.from(expected);

  if (sigA.length !== sigB.length || !crypto.timingSafeEqual(sigA, sigB)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SessionPayload;

    if (!payload?.email || !payload?.exp || Date.now() > payload.exp) {
      return null;
    }

    return { email: payload.email };
  } catch {
    return null;
  }
}

export function getConfiguredAdminEmail(): string {
  const explicit = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (explicit) return explicit;

  const allowed = (process.env.ALLOWED_ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  return allowed[0] || "";
}
