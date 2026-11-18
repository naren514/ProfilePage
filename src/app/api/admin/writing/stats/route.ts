import { studioStats } from "@/lib/writing/stats";
import { json, writingRoute } from "@/lib/writing/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return writingRoute(async () => {
    const days = Math.min(Math.max(Number(new URL(request.url).searchParams.get("days")) || 30, 1), 365);
    return json(await studioStats(days));
  });
}
