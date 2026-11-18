import { feedbackCounts } from "@/lib/writing/memory/feedback";
import { json, writingRoute } from "@/lib/writing/api";

export const dynamic = "force-dynamic";

/** How much learning evidence (accepted, edited, rejected suggestions) each style has. */
export async function GET() {
  return writingRoute(async () => json({ evidenceByStyle: await feedbackCounts() }));
}
