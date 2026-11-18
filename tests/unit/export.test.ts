import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { documentMedia, documentToMarkdown, postToMarkdown, toCsv } from "@/lib/writing/markdown";
import { htmlToDocument } from "@/lib/writing/content";

describe("Markdown export", () => {
  it("converts headings, marks, links, lists, quotes, code, rules and images", () => {
    const doc = htmlToDocument(
      '<h2>Title</h2><p><strong>bold</strong>, <em>italic</em>, <s>gone</s>, <u>under</u>, <code>x*y</code> and <a href="https://example.com/a b">a link</a>.</p>' +
        '<ul><li><p>one</p><ul><li><p>nested</p></li></ul></li><li><p>two</p></li></ul><ol start="3"><li><p>third</p></li></ol>' +
        '<blockquote><p>quoted</p></blockquote><pre><code class="language-ts">const a = 1;</code></pre><hr><img src="https://cdn.example/p.jpg" alt="A [photo]"><p>line<br>break</p>'
    );
    expect(documentToMarkdown(doc)).toBe(
      [
        "## Title",
        "**bold**, _italic_, ~~gone~~, <u>under</u>, `x*y` and [a link](https://example.com/a%20b).",
        "- one\n  - nested\n- two",
        "3. third",
        "> quoted",
        "```ts\nconst a = 1;\n```",
        "---",
        "![A photo](https://cdn.example/p.jpg)",
        "line  \nbreak",
      ].join("\n\n")
    );
  });

  it("escapes text that would otherwise become Markdown", () => {
    const doc = htmlToDocument("<p># not a heading, *not bold* and [not a link]</p><p>1. not a list</p>");
    expect(documentToMarkdown(doc)).toBe("\\# not a heading, \\*not bold\\* and \\[not a link\\]\n\n1\\. not a list");
  });

  it("adds front matter with quoted strings", () => {
    const md = postToMarkdown({
      title: 'A "quoted" title: yes',
      slug: "a-title",
      excerpt: "Short",
      status: "PUBLISHED",
      tags: ["one", "two"],
      postDate: "2026-11-01",
      publishedAt: "2026-11-02T10:00:00.000Z",
      updatedAt: "2026-11-03T10:00:00.000Z",
      bodyJson: htmlToDocument("<p>Body</p>"),
    });
    expect(md).toBe(
      '---\ntitle: "A \\"quoted\\" title: yes"\nslug: "a-title"\nstatus: published\nexcerpt: "Short"\ntags: ["one", "two"]\ndate: 2026-11-01\npublished_at: 2026-11-02T10:00:00.000Z\nupdated_at: 2026-11-03T10:00:00.000Z\n---\n\nBody\n'
    );
  });

  it("lists every image a post uses", () => {
    const doc = htmlToDocument('<img src="https://a.example/1.jpg"><ul><li><p>x</p></li></ul><img src="https://a.example/1.jpg"><img src="https://a.example/2.png">');
    expect(documentMedia(doc)).toEqual(["https://a.example/1.jpg", "https://a.example/2.png"]);
  });
});

describe("CSV", () => {
  it("quotes commas, quotes and newlines, and serializes objects", () => {
    const csv = toCsv([{ a: 'he said "hi", then\nleft', b: { x: 1 }, c: null, d: new Date("2026-01-01T00:00:00Z") }], ["a", "b", "c", "d"]);
    expect(csv).toBe('a,b,c,d\r\n"he said ""hi"", then\nleft","{""x"":1}",,2026-01-01T00:00:00.000Z\r\n');
  });

  it("produces a ZIP that JSZip can read back", async () => {
    const zip = new JSZip();
    zip.file("feedback.csv", toCsv([{ a: 1 }], ["a"]));
    const back = await JSZip.loadAsync(await zip.generateAsync({ type: "uint8array" }));
    expect(await back.file("feedback.csv")!.async("string")).toBe("a\r\n1\r\n");
  });
});
