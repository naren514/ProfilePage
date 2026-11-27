import { collectFeeds } from "@/lib/reading/feeds";
import { json, writingRoute } from "@/lib/writing/api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Read every source's feed now (the nightly job does this too). */
export async function POST() {
  return writingRoute(async () => json({ summary: await collectFeeds() }));
}
