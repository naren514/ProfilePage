// RSS 2.0 for the public feeds (posts and weekly reading lists).

export interface FeedItem {
  title: string;
  link: string;
  guid?: string;
  date: Date;
  description: string;
  /** Full content as HTML (content:encoded). */
  html?: string;
}

export function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);
}

const cdata = (s: string) => `<![CDATA[${s.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;

export function buildRss(feed: { title: string; link: string; selfUrl: string; description: string; items: FeedItem[] }): string {
  const updated = feed.items[0]?.date ?? new Date();
  const items = feed.items
    .map(
      (i) => `    <item>
      <title>${escapeXml(i.title)}</title>
      <link>${escapeXml(i.link)}</link>
      <guid isPermaLink="${i.guid ? "false" : "true"}">${escapeXml(i.guid ?? i.link)}</guid>
      <pubDate>${i.date.toUTCString()}</pubDate>
      <description>${escapeXml(i.description)}</description>${i.html ? `\n      <content:encoded>${cdata(i.html)}</content:encoded>` : ""}
    </item>`
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${escapeXml(feed.title)}</title>
    <link>${escapeXml(feed.link)}</link>
    <description>${escapeXml(feed.description)}</description>
    <language>en</language>
    <lastBuildDate>${updated.toUTCString()}</lastBuildDate>
    <atom:link href="${escapeXml(feed.selfUrl)}" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>
`;
}

export function rssResponse(xml: string) {
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=600, s-maxage=600" } });
}
