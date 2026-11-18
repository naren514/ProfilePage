import sanitizeHtml from "sanitize-html";

// Matches what the Thoughts Tiptap editor can produce (StarterKit, Underline,
// Link, Image). Anything else in a post body is dropped before it reaches a page.
const POST_HTML_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "hr",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "strong", "b", "em", "i", "u", "s", "strike", "code", "pre", "mark",
    "blockquote",
    "ul", "ol", "li",
    "a", "img",
    "figure", "figcaption",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "title", "width", "height"],
    ol: ["start"],
    code: ["class"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: { img: ["http", "https"] },
  allowProtocolRelative: false,
  allowedClasses: { code: [/^language-[\w-]+$/] },
  // An image whose source was unsafe (and removed) would show as broken
  exclusiveFilter: (frame) => frame.tag === "img" && !frame.attribs.src,
  transformTags: {
    a: (tagName, attribs) => {
      const next: Record<string, string> = { ...attribs };
      if (next.target === "_blank") next.rel = "noopener noreferrer nofollow";
      else delete next.target;
      return { tagName, attribs: next };
    },
  },
};

/** Sanitize a post body for public rendering and storage. */
export function sanitizePostHtml(html: string | null | undefined): string {
  if (!html) return "";
  return sanitizeHtml(html, POST_HTML_OPTIONS);
}

/** Plain text of a post body, for search indexes and the chatbot's context. */
export function htmlToPlainText(html: string | null | undefined): string {
  if (!html) return "";
  const withBreaks = html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|h[1-6]|li|blockquote|pre|figcaption)>/gi, "\n");
  const text = sanitizeHtml(withBreaks, { allowedTags: [], allowedAttributes: {} });
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}
