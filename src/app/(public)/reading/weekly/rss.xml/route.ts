import { weeklyLists, weekLabel } from "@/lib/reading/shortlist";
import { buildRss, escapeXml, rssResponse } from "@/lib/rss";
import { SITE_NAME, siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

/** Each approved weekly list as one item: the intro and the picks with their lines. */
export async function GET() {
  const lists = await weeklyLists(52).catch(() => []);
  return rssResponse(
    buildRss({
      title: `${SITE_NAME}: Worth your time`,
      link: siteUrl("/reading/weekly"),
      selfUrl: siteUrl("/reading/weekly/rss.xml"),
      description: "Each week, a handful of articles worth your time, with a line on why.",
      items: lists.map((l) => ({
        title: l.title || `Worth your time: ${weekLabel(l.week)}`,
        link: siteUrl(`/reading/weekly/${l.week}`),
        date: l.publishedAt,
        description: l.intro,
        html:
          (l.intro ? `<p>${escapeXml(l.intro)}</p>` : "") +
          `<ol>${l.picks.map((p) => `<li><a href="${escapeXml(p.url)}">${escapeXml(p.title)}</a> (${escapeXml(p.publisher)})<br>${escapeXml(p.line)}</li>`).join("")}</ol>`,
      })),
    })
  );
}
