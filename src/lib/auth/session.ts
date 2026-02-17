import crypto from "crypto";

export interface SessionUser {
  email: string;
  name?: string;
}

interface SessionPayload {
  email: string;
  exp: number;
}

function getSessionSecret(): string {
  return process.env.AUTH_SESSION_SECRET || process.env.ADMIN_PASSWORD || "dev-session-secret";
}

function base64url(input: string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(value: string): string {
  return crypto.createHmac("sha256", getSessionSecret()).update(value).digest("base64url");
}

export function createSessionToken(user: SessionUser, maxAgeMs: number): string {
  const payload: SessionPayload = {
    email: user.email.toLowerCase(),
    exp: Date.now() + maxAgeMs,
  };

  const encoded = base64url(JSON.stringify(payload));
  const signature = sign(encoded);
  return `${encoded}.${signature}`;
}

export function verifySessionToken(token: string | undefined | null): SessionUser | null {
  if (!token) return null;

  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  const expected = sign(encoded);
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
