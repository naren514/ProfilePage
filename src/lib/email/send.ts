// Sending email through Resend's HTTP API (no SDK). Configured with
// RESEND_API_KEY and EMAIL_FROM ("Name <weekly@yourdomain>"); without them,
// email features stay switched off. RESEND_BASE_URL points tests at a mock.

export interface Email {
  to: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
}

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

const BATCH = 100;

async function post(path: string, body: unknown) {
  const base = (process.env.RESEND_BASE_URL || "https://api.resend.com").replace(/\/+$/, "");
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`The email service refused it (${res.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`);
  }
}

const shape = (e: Email) => ({ from: process.env.EMAIL_FROM, to: [e.to], subject: e.subject, html: e.html, text: e.text, headers: e.headers });

export async function sendEmail(email: Email): Promise<void> {
  if (!emailConfigured()) throw new Error("Email isn't set up (RESEND_API_KEY and EMAIL_FROM).");
  await post("/emails", shape(email));
}

/** Many emails (one per recipient), in batches of 100. Returns how many were sent. */
export async function sendEmails(emails: Email[]): Promise<number> {
  if (!emailConfigured()) throw new Error("Email isn't set up (RESEND_API_KEY and EMAIL_FROM).");
  let sent = 0;
  for (let i = 0; i < emails.length; i += BATCH) {
    const chunk = emails.slice(i, i + BATCH);
    await post("/emails/batch", chunk.map(shape));
    sent += chunk.length;
  }
  return sent;
}
