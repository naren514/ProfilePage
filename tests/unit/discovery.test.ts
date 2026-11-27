import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import { advertisedFeeds, discoverFeed, feedText, parseFeed } from "@/lib/reading/feeds";
import { buildProfile, tasteScore, tokens } from "@/lib/reading/taste";

const RSS = `<?xml version="1.0"?><rss version="2.0"><channel><title>Money &amp; Notes</title>
<item><title><![CDATA[Fees & returns: a "decade" view]]></title><link>https://a.example/fees?utm_source=rss</link>
<description>&lt;p&gt;How &lt;b&gt;fees&lt;/b&gt; compound&amp;nbsp;over time.&lt;/p&gt;</description><pubDate>Mon, 23 Nov 2026 10:00:00 GMT</pubDate></item>
<item><title>Guid only</title><guid isPermaLink="true">https://a.example/guid</guid><description>x</description></item>
<item><title>Not a link</title><guid isPermaLink="false">tag:a.example,2026:1</guid></item>
</channel></rss>`;

const ATOM = `<?xml version="1.0" encoding="utf-8"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Build Log</title>
<entry><title>Incident reviews</title><link rel="replies" href="/comments"/><link rel="alternate" href="/posts/incidents"/><summary type="html">&lt;p&gt;Blameless reviews&lt;/p&gt;</summary><updated>2026-11-20T08:00:00Z</updated></entry>
</feed>`;

describe("reading feeds", () => {
  it("reads RSS: CDATA, escaped HTML, entities, dates, guid links", () => {
    const items = parseFeed(RSS, "https://a.example/feed");
    expect(items.map((i) => i.url)).toEqual(["https://a.example/fees?utm_source=rss", "https://a.example/guid"]);
    expect(items[0].title).toBe('Fees & returns: a "decade" view');
    expect(items[0].summary).toBe("How fees compound over time.");
    expect(items[0].publishedAt?.toISOString()).toBe("2026-11-23T10:00:00.000Z");
  });

  it("reads Atom, preferring the alternate link and resolving it", () => {
    const [e] = parseFeed(ATOM, "https://b.example/feed.atom");
    expect(e).toMatchObject({ title: "Incident reviews", url: "https://b.example/posts/incidents", summary: "Blameless reviews" });
  });

  it("returns nothing for a page that isn't a feed", () => {
    expect(parseFeed("<html><body>hi</body></html>")).toEqual([]);
  });

  it("finds feeds a page advertises", () => {
    const html = `<head><link rel="alternate" type="application/rss+xml" href="/feed.xml"><link rel="stylesheet" href="/x.css"></head>`;
    expect(advertisedFeeds(html, "https://c.example/blog/")).toEqual(["https://c.example/feed.xml"]);
  });

  it("discovers a site's feed: advertised first, then common paths", async () => {
    const pages: Record<string, string> = {
      "https://c.example/": `<html><head><link rel="alternate" type="application/atom+xml" href="/atom.xml"></head></html>`,
      "https://c.example/atom.xml": ATOM,
      "https://d.example/": "<html>no feed link</html>",
      "https://d.example/rss": RSS,
    };
    const fetcher = async (u: URL) => ({ finalUrl: u.toString(), status: pages[u.toString()] ? 200 : 404, body: pages[u.toString()] ?? "" });
    expect((await discoverFeed("https://c.example", fetcher))?.feedUrl).toBe("https://c.example/atom.xml");
    const d = await discoverFeed("d.example", fetcher);
    expect(d?.feedUrl).toBe("https://d.example/rss");
    expect(d?.title).toBe("Money & Notes");
    expect(await discoverFeed("https://e.example", fetcher)).toBeNull();
  });

  it("cleans feed text and caps its length", () => {
    expect(feedText("<p>a &amp;amp; b</p>")).toBe("a & b");
    expect(feedText("word ".repeat(400), 50).length).toBeLessThanOrEqual(50);
  });
});

describe("taste ranking", () => {
  const profile = buildProfile({
    positives: ["Why low-cost index funds win over decades. Index funds, fees and long-term investing returns."],
    negatives: ["Celebrity crypto coins to buy now"],
    candidates: ["Bond ladders", "Sourdough", "Crypto"],
    topics: ["Investments", "Leadership"],
  });

  it("ignores common words and plurals", () => {
    expect(tokens("The funds and the fees of investing")).toEqual(["fund", "fee", "investing"]);
  });

  it("ranks articles like the ones the author kept above unrelated ones", () => {
    const like = tasteScore(profile, "What two decades of index fund fees did to long-term returns", "Investments");
    const unrelated = tasteScore(profile, "My weekend sourdough experiments with flour and starter", "Investments");
    expect(like).toBeGreaterThan(unrelated + 0.2);
  });

  it("pushes down articles like the ones the author removed", () => {
    const removedLike = tasteScore(profile, "More celebrity crypto coins to buy now", "Investments");
    const neutral = tasteScore(profile, "A quiet week in markets", "Investments");
    expect(removedLike).toBeLessThan(neutral);
  });

  it("counts history from the first kept article, more as it grows", () => {
    expect(profile.historyWeight).toBeCloseTo(1 / 3);
    const empty = buildProfile({ positives: [], negatives: [], candidates: [], topics: ["Leadership"] });
    expect(tasteScore(empty, "Leadership lessons for new managers", "Leadership")).toBeGreaterThan(tasteScore(empty, "Gardening tips", "Leadership"));
  });
});
