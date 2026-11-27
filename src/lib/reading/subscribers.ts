import { randomBytes } from "crypto";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { readingSubscribers, readingWeeklyLists, type ReadingWeeklyList } from "@/lib/db/schema";
import { sendEmail, sendEmails, type Email } from "@/lib/email/send";
import { escapeXml } from "@/lib/rss";
import { SITE_NAME, siteUrl } from "@/lib/site";
import { weekLabel } from "./shortlist";

// The weekly list by email. Double opt-in (a confirmation link), a
// one-click unsubscribe in every email, and each list emailed once.

const EMAIL = /^[^\s@<>()",;:]{1,64}@[^\s@<>()",;:]+\.[a-z]{2,}$/i;

export function normalizeEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  return email.length <= 254 && EMAIL.test(email) ? email : null;
}

const newToken = () => randomBytes(24).toString("base64url");

/** Don't send another confirmation to the same address within this time. */
const RESEND_AFTER_MS = 10 * 60_000;

const esc = escapeXml;

function layout(body: string, footer: string) {
  return `<!doctype html><html><body style="margin:0;background:#fafaf9;color:#18181b;font-family:Georgia,'Times New Roman',serif">
<div style="max-width:600px;margin:0 auto;padding:32px 24px">${body}
<hr style="border:none;border-top:1px solid #e4e4e7;margin:32px 0 16px">
<p style="font-family:-apple-system,'Segoe UI',sans-serif;font-size:12px;line-height:1.6;color:#71717a">${footer}</p>
</div></body></html>`;
}

export function confirmationEmail(to: string, token: string): Email {
  const link = siteUrl(`/api/subscribe/confirm?token=${encodeURIComponent(token)}`);
  return {
    to,
    subject: `Confirm: ${SITE_NAME}'s weekly reading list`,
    html: layout(
      `<p style="font-size:20px;line-height:1.4">Confirm you'd like the weekly reading list</p>
<p style="font-size:16px;line-height:1.6;color:#3f3f46">Once a week, a handful of articles worth your time, with a line on why. Press the button to start getting it.</p>
<p><a href="${esc(link)}" style="display:inline-block;background:#18181b;color:#fafaf9;text-decoration:none;padding:12px 20px;border-radius:999px;font-family:-apple-system,'Segoe UI',sans-serif;font-size:15px">Yes, send it to me</a></p>`,
      `If you didn't ask for this, ignore this email and nothing will be sent.`
    ),
    text: `Confirm you'd like ${SITE_NAME}'s weekly reading list:\n${link}\n\nIf you didn't ask for this, ignore this email and nothing will be sent.`,
  };
}

export function weeklyEmail(list: Pick<ReadingWeeklyList, "week" | "title" | "intro" | "picks">, to: string, token: string): Email {
  const web = siteUrl(`/reading/weekly/${list.week}`);
  const unsubscribe = siteUrl(`/unsubscribe?token=${encodeURIComponent(token)}`);
  const oneClick = siteUrl(`/api/subscribe/unsubscribe?token=${encodeURIComponent(token)}`);
  const title = list.title || `Worth your time: ${weekLabel(list.week)}`;
  const picks = list.picks
    .map(
      (p, i) => `<div style="margin:0 0 28px">
<p style="margin:0 0 4px;font-family:-apple-system,'Segoe UI',sans-serif;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#71717a">${i + 1} · ${esc(p.publisher)}</p>
<p style="margin:0 0 6px;font-size:20px;line-height:1.35"><a href="${esc(p.url)}" style="color:#18181b">${esc(p.title)}</a></p>
<p style="margin:0;font-size:16px;line-height:1.6;color:#3f3f46">${esc(p.line)}</p></div>`
    )
    .join("");
  return {
    to,
    subject: title,
    html: layout(
      `<p style="margin:0 0 4px;font-family:-apple-system,'Segoe UI',sans-serif;font-size:12px;color:#71717a">${esc(SITE_NAME)} · ${esc(weekLabel(list.week))}</p>
<h1 style="margin:0 0 16px;font-size:28px;line-height:1.2;font-weight:normal">${esc(title)}</h1>
${list.intro ? `<p style="margin:0 0 28px;font-size:17px;line-height:1.6;color:#3f3f46">${esc(list.intro)}</p>` : ""}${picks}`,
      `<a href="${esc(web)}" style="color:#71717a">Read it on the web</a> · You get this because you signed up for ${esc(SITE_NAME)}'s weekly reading list. <a href="${esc(unsubscribe)}" style="color:#71717a">Unsubscribe</a>`
    ),
    text: `${title}\n${weekLabel(list.week)}\n\n${list.intro ? `${list.intro}\n\n` : ""}${list.picks.map((p, i) => `${i + 1}. ${p.title} (${p.publisher})\n${p.url}\n${p.line}`).join("\n\n")}\n\nOn the web: ${web}\nUnsubscribe: ${unsubscribe}`,
    headers: { "List-Unsubscribe": `<${oneClick}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  };
}

/**
 * Sign up an address. Always ends the same way for the visitor ("check your
 * inbox"), so the form can't be used to learn who is subscribed.
 */
export async function subscribe(raw: string): Promise<"sent" | "already" | "invalid" | "wait"> {
  const email = normalizeEmail(raw);
  if (!email) return "invalid";
  const [existing] = await db.select().from(readingSubscribers).where(eq(readingSubscribers.email, email)).limit(1);
  if (existing?.status === "active") return "already";
  if (existing?.status === "pending" && existing.confirmSentAt && Date.now() - existing.confirmSentAt.getTime() < RESEND_AFTER_MS) return "wait";
  const token = existing?.status === "pending" ? existing.token : newToken();
  if (existing) {
    await db.update(readingSubscribers).set({ status: "pending", token, confirmSentAt: new Date(), unsubscribedAt: null }).where(eq(readingSubscribers.id, existing.id));
  } else {
    await db.insert(readingSubscribers).values({ email, token, status: "pending", confirmSentAt: new Date() }).onConflictDoNothing();
  }
  await sendEmail(confirmationEmail(email, token));
  return "sent";
}

export async function confirmSubscription(token: string): Promise<boolean> {
  if (!token || token.length > 100) return false;
  const [row] = await db.select().from(readingSubscribers).where(eq(readingSubscribers.token, token)).limit(1);
  if (!row || row.status === "unsubscribed") return false;
  if (row.status === "pending") await db.update(readingSubscribers).set({ status: "active", confirmedAt: new Date() }).where(eq(readingSubscribers.id, row.id));
  return true;
}

export async function unsubscribe(token: string): Promise<boolean> {
  if (!token || token.length > 100) return false;
  const rows = await db.update(readingSubscribers).set({ status: "unsubscribed", unsubscribedAt: new Date() }).where(eq(readingSubscribers.token, token)).returning({ id: readingSubscribers.id });
  return rows.length > 0;
}

export async function listSubscribers() {
  return db
    .select({ id: readingSubscribers.id, email: readingSubscribers.email, status: readingSubscribers.status, createdAt: readingSubscribers.createdAt, confirmedAt: readingSubscribers.confirmedAt })
    .from(readingSubscribers)
    .orderBy(asc(readingSubscribers.status), asc(readingSubscribers.createdAt));
}

export async function removeSubscriber(id: string): Promise<boolean> {
  const rows = await db.delete(readingSubscribers).where(eq(readingSubscribers.id, id)).returning({ id: readingSubscribers.id });
  return rows.length > 0;
}

/**
 * Email a published list to everyone subscribed. Claims the list first, so
 * a repeat (double approval, a retry, two tabs) never sends it twice; if
 * sending fails the claim is released so it can be tried again.
 */
export async function emailWeeklyList(listId: string): Promise<{ sent: number; skipped?: "already_sent" | "not_found" }> {
  const [claimed] = await db
    .update(readingWeeklyLists)
    .set({ emailedAt: new Date() })
    .where(and(eq(readingWeeklyLists.id, listId), isNull(readingWeeklyLists.emailedAt)))
    .returning();
  if (!claimed) {
    const [exists] = await db.select({ id: readingWeeklyLists.id }).from(readingWeeklyLists).where(eq(readingWeeklyLists.id, listId)).limit(1);
    return { sent: 0, skipped: exists ? "already_sent" : "not_found" };
  }
  try {
    const readers = await db.select({ email: readingSubscribers.email, token: readingSubscribers.token }).from(readingSubscribers).where(eq(readingSubscribers.status, "active"));
    const sent = readers.length ? await sendEmails(readers.map((r) => weeklyEmail(claimed, r.email, r.token))) : 0;
    await db.update(readingWeeklyLists).set({ emailedCount: sent }).where(eq(readingWeeklyLists.id, listId));
    return { sent };
  } catch (error) {
    await db.update(readingWeeklyLists).set({ emailedAt: null }).where(eq(readingWeeklyLists.id, listId));
    throw error;
  }
}

export async function subscriberCounts() {
  const rows = await db.select({ status: readingSubscribers.status, n: sql<number>`count(*)::int` }).from(readingSubscribers).groupBy(readingSubscribers.status);
  const by = Object.fromEntries(rows.map((r) => [r.status, r.n])) as Record<string, number>;
  return { active: by.active ?? 0, pending: by.pending ?? 0, unsubscribed: by.unsubscribed ?? 0 };
}
