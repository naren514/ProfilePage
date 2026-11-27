import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import { buildRss } from "@/lib/rss";
import { confirmationEmail, normalizeEmail, weeklyEmail } from "@/lib/reading/subscribers";

describe("RSS", () => {
  it("escapes text, keeps HTML in CDATA, and links to itself", () => {
    const xml = buildRss({
      title: "A & B",
      link: "https://x.example/thoughts",
      selfUrl: "https://x.example/thoughts/rss.xml",
      description: "<desc>",
      items: [{ title: "Fees & <returns>", link: "https://x.example/thoughts/a?b=1&c=2", date: new Date("2026-11-23T10:00:00Z"), description: "d", html: "<p>body ]]> end</p>" }],
    });
    expect(xml).toContain("<title>A &amp; B</title>");
    expect(xml).toContain("<title>Fees &amp; &lt;returns&gt;</title>");
    expect(xml).toContain("<link>https://x.example/thoughts/a?b=1&amp;c=2</link>");
    expect(xml).toContain('<atom:link href="https://x.example/thoughts/rss.xml" rel="self"');
    expect(xml).toContain("<pubDate>Mon, 23 Nov 2026 10:00:00 GMT</pubDate>");
    expect(xml).toContain("<![CDATA[<p>body ]]]]><![CDATA[> end</p>]]>");
  });
});

describe("weekly email", () => {
  it("accepts real addresses and normalises them", () => {
    expect(normalizeEmail("  Reader@Example.COM ")).toBe("reader@example.com");
    expect(normalizeEmail("no-at-sign")).toBeNull();
    expect(normalizeEmail("a@b")).toBeNull();
    expect(normalizeEmail("x<script>@evil.com")).toBeNull();
  });

  it("confirmation links go to the site with the token", () => {
    process.env.SITE_URL = "https://site.example/";
    const e = confirmationEmail("r@example.com", "tok_123");
    expect(e.text).toContain("https://site.example/api/subscribe/confirm?token=tok_123");
    expect(e.html).toContain("Yes, send it to me");
  });

  it("the list email escapes content and carries one-click unsubscribe", () => {
    process.env.SITE_URL = "https://site.example";
    const e = weeklyEmail(
      { week: "2026-W48", title: "Five <good> reads", intro: "Intro & more", picks: [{ ref: "c1", title: "Fees & returns", url: "https://a.example/x?y=1&z=2", publisher: "A", topic: "Finance", line: "Why it matters." }] } as never,
      "r@example.com",
      "tok_9"
    );
    expect(e.subject).toBe("Five <good> reads");
    expect(e.html).toContain("Five &lt;good&gt; reads");
    expect(e.html).toContain('href="https://a.example/x?y=1&amp;z=2"');
    expect(e.html).toContain("https://site.example/unsubscribe?token=tok_9");
    expect(e.headers?.["List-Unsubscribe"]).toBe("<https://site.example/api/subscribe/unsubscribe?token=tok_9>");
    expect(e.headers?.["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    expect(e.text).toContain("1. Fees & returns (A)");
  });
});
