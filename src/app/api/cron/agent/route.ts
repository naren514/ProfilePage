import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { agentTick } from "@/lib/agent/triggers";
import { isMissingTable } from "@/lib/http/errors";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * The agent scheduler tick (agent PRD A1). Vercel Cron calls this (see
 * vercel.json) with `Authorization: Bearer $CRON_SECRET`. It fires due
 * triggers, re-enqueues orphaned runs and expires stale approvals.
 * `?now=` (a test clock) is honoured only when AGENT_TEST_CLOCK=1.
 */
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: "CRON_SECRET isn't set on the server.", code: "NOT_CONFIGURED" }, { status: 503 });
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  const nowParam = new URL(request.url).searchParams.get("now");
  const now = process.env.AGENT_TEST_CLOCK === "1" && process.env.VERCEL_ENV !== "production" && nowParam ? new Date(nowParam) : new Date();
  if (Number.isNaN(now.getTime())) return NextResponse.json({ error: "Invalid now" }, { status: 400 });
  try {
    return NextResponse.json(await agentTick(now));
  } catch (error) {
    if (isMissingTable(error)) return NextResponse.json({ error: "Run the Writing Studio setup first.", code: "SETUP_REQUIRED" }, { status: 503 });
    console.error("Agent tick failed:", error);
    return NextResponse.json({ error: "The tick failed; see the server log.", code: "INTERNAL" }, { status: 500 });
  }
}
