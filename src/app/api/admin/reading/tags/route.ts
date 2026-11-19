import { NextResponse } from "next/server";
import { readingRoute } from "@/lib/reading/api";
import { knownTopicLabels } from "@/lib/topics-data";

export const dynamic = "force-dynamic";

/** Every topic in use across posts and reading items, most used first. */
export async function GET() {
  return readingRoute(async () => NextResponse.json({ tags: await knownTopicLabels() }));
}
