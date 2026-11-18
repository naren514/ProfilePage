// Editor JSON → Markdown, for the portable export. Markdown is the readable
// copy; the JSON stays the lossless original (PRD §12).

interface Mark {
  type: string;
  attrs?: Record<string, unknown>;
}
interface PMNode {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: Mark[];
  content?: PMNode[];
}

function escapeText(text: string): string {
  return text
    .replace(/([\\`*_[\]<>])/g, "\\$1")
    // Line starts that Markdown would read as a heading, quote, list item or numbered list
    .replace(/^(\s*)([#>+-])(\s)/, "$1\\$2$3")
    .replace(/^(\s*)(\d+)\.(\s)/, "$1$2\\.$3");
}

function inline(nodes: PMNode[] = []): string {
  return nodes
    .map((node) => {
      if (node.type === "hardBreak") return "  \n";
      if (node.type === "image") return image(node);
      if (node.type !== "text" || !node.text) return "";
      const marks = node.marks ?? [];
      const isCode = marks.some((m) => m.type === "code");
      let out = isCode ? `\`${node.text.replace(/`/g, "\\`")}\`` : escapeText(node.text);
      for (const mark of marks) {
        if (mark.type === "bold") out = `**${out}**`;
        else if (mark.type === "italic") out = `_${out}_`;
        else if (mark.type === "strike") out = `~~${out}~~`;
        else if (mark.type === "underline") out = `<u>${out}</u>`;
      }
      const link = marks.find((m) => m.type === "link");
      if (link?.attrs?.href) out = `[${out}](${String(link.attrs.href).replace(/[()\s]/g, encodeURIComponent)})`;
      return out;
    })
    .join("");
}

function image(node: PMNode): string {
  const src = String(node.attrs?.src ?? "");
  if (!src) return "";
  const alt = String(node.attrs?.alt ?? "").replace(/[[\]]/g, "");
  return `![${alt}](${src.replace(/[()\s]/g, encodeURIComponent)})`;
}

function block(node: PMNode, indent = ""): string {
  switch (node.type) {
    case "paragraph":
      return indent + inline(node.content);
    case "heading":
      return `${"#".repeat(Math.min(Math.max(Number(node.attrs?.level ?? 2), 1), 6))} ${inline(node.content)}`;
    case "blockquote":
      return (node.content ?? []).map((c) => block(c)).join("\n\n").split("\n").map((l) => (l ? `> ${l}` : ">")).join("\n");
    case "codeBlock": {
      const lang = String(node.attrs?.language ?? "");
      const code = (node.content ?? []).map((c) => c.text ?? "").join("");
      return "```" + lang + "\n" + code + "\n```";
    }
    case "horizontalRule":
      return "---";
    case "image":
      return image(node);
    case "bulletList":
    case "orderedList": {
      const start = Number(node.attrs?.start ?? 1);
      return (node.content ?? [])
        .map((item, i) => {
          const marker = node.type === "orderedList" ? `${start + i}.` : "-";
          const pad = " ".repeat(marker.length + 1);
          const parts = (item.content ?? []).map((c) => block(c));
          const [first = "", ...rest] = parts.join("\n").split("\n");
          return [`${indent}${marker} ${first}`, ...rest.map((l) => (l ? `${indent}${pad}${l}` : ""))].join("\n");
        })
        .join("\n");
    }
    default:
      return inline(node.content);
  }
}

export function documentToMarkdown(doc: unknown): string {
  const root = doc as PMNode;
  return (root?.content ?? [])
    .map((n) => block(n))
    .filter((s) => s.trim() !== "")
    .join("\n\n")
    .trim();
}

function yamlString(value: string): string {
  return JSON.stringify(value);
}

/** Front matter + body, for one post. */
export function postToMarkdown(post: {
  title: string;
  slug: string | null;
  excerpt: string;
  status: string;
  tags: string[];
  postDate: string | null;
  publishedAt: Date | string | null;
  updatedAt: Date | string;
  bodyJson: unknown;
}): string {
  const lines = [
    "---",
    `title: ${yamlString(post.title || "Untitled")}`,
    post.slug ? `slug: ${yamlString(post.slug)}` : null,
    `status: ${post.status.toLowerCase()}`,
    post.excerpt ? `excerpt: ${yamlString(post.excerpt)}` : null,
    post.tags.length ? `tags: [${post.tags.map(yamlString).join(", ")}]` : null,
    post.postDate ? `date: ${post.postDate}` : null,
    post.publishedAt ? `published_at: ${new Date(post.publishedAt).toISOString()}` : null,
    `updated_at: ${new Date(post.updatedAt).toISOString()}`,
    "---",
    "",
  ].filter((l) => l !== null);
  return `${lines.join("\n")}\n${documentToMarkdown(post.bodyJson)}\n`;
}

/** Every image URL a document uses (for the media manifest). */
export function documentMedia(doc: unknown): string[] {
  const urls = new Set<string>();
  const walk = (node: PMNode) => {
    if (node.type === "image" && node.attrs?.src) urls.add(String(node.attrs.src));
    node.content?.forEach(walk);
  };
  walk(doc as PMNode);
  return Array.from(urls);
}

/** RFC 4180 CSV. */
export function toCsv(rows: Array<Record<string, unknown>>, columns: string[]): string {
  const cell = (v: unknown) => {
    const s = v === null || v === undefined ? "" : v instanceof Date ? v.toISOString() : typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.join(","), ...rows.map((r) => columns.map((c) => cell(r[c])).join(","))].join("\r\n") + "\r\n";
}
