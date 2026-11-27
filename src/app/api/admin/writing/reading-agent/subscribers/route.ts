import { emailConfigured } from "@/lib/email/send";
import { listSubscribers, subscriberCounts } from "@/lib/reading/subscribers";
import { json, writingRoute } from "@/lib/writing/api";

export const dynamic = "force-dynamic";

/** Who gets the weekly list by email, and whether email is set up. */
export async function GET() {
  return writingRoute(async () => json({ configured: emailConfigured(), counts: await subscriberCounts(), subscribers: await listSubscribers() }));
}
