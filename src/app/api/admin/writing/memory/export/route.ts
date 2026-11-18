import { asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { writingSamples, writingStyles, writingStyleVersions } from "@/lib/db/schema";
import { listFeedback } from "@/lib/writing/memory/feedback";
import { writingRoute } from "@/lib/writing/api";

export const dynamic = "force-dynamic";

/** Writing memory as one open JSON file: styles (with history), samples and feedback (FR-MEM-005). */
export async function GET() {
  return writingRoute(async () => {
    const [styles, versions, samples, feedback] = await Promise.all([
      db.select().from(writingStyles).orderBy(asc(writingStyles.createdAt)),
      db.select().from(writingStyleVersions).orderBy(asc(writingStyleVersions.createdAt)),
      db.select().from(writingSamples).orderBy(asc(writingSamples.createdAt)),
      listFeedback({ limit: 5000 }),
    ]);
    const body = {
      format: "writing-studio-memory",
      version: 1,
      exportedAt: new Date().toISOString(),
      styles: styles.map((s) => ({ ...s, history: versions.filter((v) => v.styleId === s.id) })),
      samples,
      feedback,
    };
    const date = new Date().toISOString().slice(0, 10);
    return new Response(JSON.stringify(body, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="writing-memory-${date}.json"`,
      },
    });
  });
}
