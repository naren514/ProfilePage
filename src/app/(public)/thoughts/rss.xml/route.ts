import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { stories } from "@/lib/db/schema";
import { sanitizePostHtml } from "@/lib/content/sanitize";
import { buildRss, rssResponse } from "@/lib/rss";
import { SITE_NAME, siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

/** Published posts, newest first, with their full text. */
export async function GET() {
  const posts = await db
    .select()
    .from(stories)
    .where(eq(stories.isPublished, true))
    .orderBy(desc(stories.date), desc(stories.createdAt))
    .limit(50)
    .catch(() => []);
  return rssResponse(
    buildRss({
      title: `${SITE_NAME}: Thoughts`,
      link: siteUrl("/thoughts"),
      selfUrl: siteUrl("/thoughts/rss.xml"),
      description: "Notes on building, learning, and the occasional hard-won lesson.",
      items: posts.map((p) => ({
        title: p.title,
        link: siteUrl(`/thoughts/${p.slug}`),
        date: p.date ? new Date(p.date) : p.createdAt,
        description: p.summary ?? "",
        html: sanitizePostHtml(p.action),
      })),
    })
  );
}
