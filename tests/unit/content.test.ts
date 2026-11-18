import { describe, expect, it } from "vitest";
import { documentStats, documentToHtml, htmlToDocument, InvalidDocumentError, parseDocument } from "@/lib/writing/content";
import { sanitizePostHtml } from "@/lib/content/sanitize";
import { emptyDocument } from "@/lib/writing/extensions";
import { liveChangedOutsideStudio, needsSlugConfirmation, publishProblems } from "@/lib/writing/publish-rules";

// HTML as the old Thoughts editor saved it (Tiptap StarterKit + Underline + Link + Image).
const LEGACY_FIXTURES: Record<string, string> = {
  paragraphsAndMarks:
    "<p>Plain, <strong>bold</strong>, <em>italic</em>, <u>underlined</u>, <s>struck</s> and <code>code</code>.</p><p>Second paragraph.</p>",
  headings: "<h1>Pasted H1</h1><h2>Section</h2><p>Body</p><h3>Sub</h3><p>More</p>",
  lists:
    "<ul><li><p>One</p></li><li><p>Two</p><ul><li><p>Nested</p></li></ul></li></ul><ol><li><p>First</p></li><li><p>Second</p></li></ol>",
  orderedStart: '<ol start="3"><li><p>Third</p></li></ol>',
  links:
    '<p>See <a target="_blank" rel="noopener noreferrer nofollow" href="https://example.com/a?b=1">this article</a> and <a target="_blank" rel="noopener noreferrer nofollow" href="mailto:hi@example.com">email</a>.</p>',
  image: '<p>Before</p><img src="https://example.com/photo.jpg" alt="A lake at dawn"><p>After</p>',
  quoteAndRule: "<blockquote><p>Quoted thought.</p></blockquote><hr><p>After the rule.</p>",
  codeBlock: '<pre><code class="language-ts">const x = 1;\nconsole.log(x);</code></pre>',
  hardBreak: "<p>Line one<br>Line two</p>",
};

describe("legacy post round trip (HTML → editor JSON → HTML)", () => {
  for (const [name, html] of Object.entries(LEGACY_FIXTURES)) {
    it(`preserves ${name}`, () => {
      const out = documentToHtml(htmlToDocument(html));
      expect(normalize(out)).toBe(normalize(sanitizePostHtml(html)));
    });
  }

  it("is stable: converting twice gives the same result", () => {
    const html = Object.values(LEGACY_FIXTURES).join("");
    const once = documentToHtml(htmlToDocument(html));
    expect(documentToHtml(htmlToDocument(once))).toBe(once);
  });

  it("keeps text from loose, non-editor HTML", () => {
    const out = documentToHtml(htmlToDocument("Loose <b>text</b> without paragraphs<div>and a div</div>"));
    expect(out).toContain("<strong>text</strong>");
    expect(out).toContain("and a div");
  });

  it("drops scripts and unsafe links on import", () => {
    const out = documentToHtml(htmlToDocument('<p>ok</p><script>alert(1)</script><p><a href="javascript:alert(1)">x</a></p>'));
    expect(out).not.toMatch(/script|javascript:/);
    expect(out).toContain("<p>ok</p>");
  });

  it("handles empty bodies", () => {
    expect(documentToHtml(htmlToDocument(null))).toBe("<p></p>");
  });
});

/** Ignore attribute order and self-closing style differences. */
function normalize(html: string) {
  return html
    .replace(/<(\w+)([^>]*?)\s*\/?>/g, (_, tag: string, attrs: string) => {
      const sorted = (attrs.match(/\s[\w-]+(="[^"]*")?/g) ?? []).map((a) => a.trim()).sort().join(" ");
      return `<${tag}${sorted ? " " + sorted : ""}>`;
    })
    .trim();
}

describe("document validation and stats", () => {
  it("counts words across blocks", () => {
    const doc = htmlToDocument("<h2>Two words</h2><p>three more words</p><ul><li><p>and four</p></li></ul>");
    expect(documentStats(doc).wordCount).toBe(7);
  });

  it("accepts the empty document", () => {
    expect(documentStats(emptyDocument()).wordCount).toBe(0);
  });

  it.each([
    ["unknown node", { type: "doc", content: [{ type: "iframe" }] }],
    ["wrong root", { type: "paragraph" }],
    ["invalid nesting", { type: "doc", content: [{ type: "text", text: "loose text at the root" }] }],
    ["not an object", "hello"],
  ])("rejects %s", (_name, json) => {
    expect(() => parseDocument(json)).toThrow(InvalidDocumentError);
  });

  it("handles a 20,000-word document", () => {
    const paragraphs = Array.from({ length: 400 }, (_, i) => `<p>${`word${i} `.repeat(50)}</p>`).join("");
    const doc = htmlToDocument(paragraphs);
    const started = performance.now();
    const { wordCount } = documentStats(doc);
    const html = documentToHtml(doc);
    expect(wordCount).toBe(20_000);
    expect(html.length).toBeGreaterThan(100_000);
    expect(performance.now() - started).toBeLessThan(2000);
  });
});

describe("publish rules", () => {
  const ready = { title: "T", slug: "t", excerpt: "E", wordCount: 3, bodyJson: emptyDocument() };

  it("passes a complete draft", () => {
    expect(publishProblems(ready)).toEqual([]);
  });

  it("lists everything that's missing", () => {
    const problems = publishProblems({ title: " ", slug: null, excerpt: "", wordCount: 0, bodyJson: emptyDocument() });
    expect(problems).toHaveLength(4);
  });

  it("rejects an invalid slug", () => {
    expect(publishProblems({ ...ready, slug: "Not Valid" })).toHaveLength(1);
  });

  it("allows an image-only post", () => {
    const body = { type: "doc", content: [{ type: "image", attrs: { src: "https://x/y.jpg" } }] };
    expect(publishProblems({ ...ready, wordCount: 0, bodyJson: body })).toEqual([]);
  });

  it("requires confirmation to change a live post's URL", () => {
    const live = { slug: "old", isPublished: true };
    expect(needsSlugConfirmation(live, "new", false)).toBe(true);
    expect(needsSlugConfirmation(live, "new", true)).toBe(false);
    expect(needsSlugConfirmation(live, "old", false)).toBe(false);
    expect(needsSlugConfirmation({ slug: "old", isPublished: false }, "new", false)).toBe(false);
    expect(needsSlugConfirmation(null, "new", false)).toBe(false);
  });

  it("detects edits made outside the Studio", () => {
    const synced = new Date("2026-11-18T10:00:00.000Z");
    expect(liveChangedOutsideStudio(new Date("2026-11-18T10:00:00.500Z"), synced)).toBe(false);
    expect(liveChangedOutsideStudio(new Date("2026-11-18T10:05:00.000Z"), synced)).toBe(true);
    expect(liveChangedOutsideStudio(null, synced)).toBe(false);
  });
});
