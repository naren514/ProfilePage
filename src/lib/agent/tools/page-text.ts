import { decodeEntities } from "@/lib/reading/metadata";

// The readable text of a web page for the agent's web.fetch tool. Pure (no
// I/O), unit tested. It keeps paragraphs and headings from the page's main
// content and drops scripts, styles, navigation, forms and boilerplate.

const DROP_BLOCKS = /<(script|style|noscript|template|svg|iframe|nav|header|footer|aside|form|button|select)\b[\s\S]*?<\/\1>/gi;
const COMMENTS = /<!--[\s\S]*?-->/g;
const HIDDEN = /<[^>]+(?:hidden|aria-hidden=["']true["']|display:\s*none)[^>]*>[\s\S]*?<\/[a-z0-9]+>/gi;

function pickMain(html: string): string {
  for (const tag of ["article", "main"]) {
    const m = html.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
    if (m && m[1].replace(/<[^>]+>/g, "").trim().length > 400) return m[1];
  }
  const body = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  return body ? body[1] : html;
}

export function pageText(html: string, maxChars = 8000): { title: string; text: string } {
  const title = decodeEntities((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").replace(/\s+/g, " ").trim()).slice(0, 300);
  const main = pickMain(html.replace(COMMENTS, " ").replace(DROP_BLOCKS, " ").replace(HIDDEN, " "));
  const text = decodeEntities(
    main
      .replace(/<(h[1-6])\b[^>]*>/gi, "\n\n## ")
      .replace(/<li\b[^>]*>/gi, "\n- ")
      .replace(/<\/(p|div|section|h[1-6]|li|blockquote|tr|br)\s*>|<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .split("\n")
    .map((l) => l.replace(/[ \t ]+/g, " ").trim())
    .filter((l, i, all) => l.length > 0 && !(l === "-" || l === "##") && !(i > 0 && l === all[i - 1]))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { title, text: text.length > maxChars ? text.slice(0, maxChars).replace(/\s+\S*$/, "") + " …" : text };
}
