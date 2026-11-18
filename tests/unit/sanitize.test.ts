import { describe, expect, it } from "vitest";
import { htmlToPlainText, sanitizePostHtml } from "@/lib/content/sanitize";

describe("sanitizePostHtml", () => {
  it("keeps everything the Thoughts editor produces", () => {
    const html =
      '<h2>Heading</h2><p><strong>bold</strong> <em>italic</em> <u>under</u> <s>strike</s> <code>x</code></p>' +
      '<ul><li><p>one</p></li></ul><ol start="3"><li><p>three</p></li></ol>' +
      '<blockquote><p>quote</p></blockquote><hr>' +
      '<p><a href="https://example.com" target="_blank">link</a></p>' +
      '<img src="https://example.com/a.jpg" alt="A photo">' +
      '<pre><code class="language-ts">const a = 1;</code></pre>';
    const out = sanitizePostHtml(html);
    for (const fragment of [
      "<h2>Heading</h2>", "<strong>bold</strong>", "<em>italic</em>", "<u>under</u>", "<s>strike</s>",
      "<ul><li><p>one</p></li></ul>", '<ol start="3">', "<blockquote>", "<hr />",
      'href="https://example.com"', 'alt="A photo"', 'class="language-ts"',
    ]) {
      expect(out).toContain(fragment);
    }
  });

  it("adds a safe rel to links that open a new tab", () => {
    const out = sanitizePostHtml('<a href="https://example.com" target="_blank">x</a>');
    expect(out).toContain('rel="noopener noreferrer nofollow"');
  });

  it.each([
    ['<script>alert(1)</script><p>ok</p>', "<script"],
    ['<img src="x" onerror="alert(1)">', "onerror"],
    ['<a href="javascript:alert(1)">x</a>', "javascript:"],
    ['<iframe src="https://evil.example"></iframe>', "<iframe"],
    ['<p style="position:fixed">x</p>', "style="],
    ['<img src="data:image/svg+xml;base64,PHN2Zz4=">', "data:"],
    ['<svg><script>alert(1)</script></svg>', "<svg"],
    ['<form action="https://evil.example"><input></form>', "<form"],
  ])("strips %s", (input, forbidden) => {
    expect(sanitizePostHtml(input)).not.toContain(forbidden);
  });

  it("drops images whose only source was unsafe", () => {
    expect(sanitizePostHtml('<p>a</p><img src="javascript:alert(1)" alt="x">')).toBe("<p>a</p>");
  });

  it("handles empty bodies", () => {
    expect(sanitizePostHtml(null)).toBe("");
    expect(sanitizePostHtml(undefined)).toBe("");
    expect(sanitizePostHtml("")).toBe("");
  });
});

describe("htmlToPlainText", () => {
  it("turns post HTML into readable text for the chatbot", () => {
    const text = htmlToPlainText("<h2>Title</h2><p>Hello &amp; welcome</p><ul><li><p>One</p></li><li><p>Two</p></li></ul>");
    expect(text).toBe("Title\nHello & welcome\nOne\nTwo");
  });

  it("drops script content entirely", () => {
    expect(htmlToPlainText("<p>a</p><script>secret()</script>")).toBe("a");
  });
});
