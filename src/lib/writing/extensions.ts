import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import type { Extensions } from "@tiptap/core";

/**
 * The document schema shared by the browser editor and the server
 * (HTML import, validation, publishing). Anything not listed here can't exist
 * in a document, so pasted content is reduced to these nodes and marks.
 * StarterKit v3 already includes Link and Underline.
 */
export function documentExtensions(): Extensions {
  return [
    StarterKit.configure({
      // All levels, so imported posts keep their headings; the toolbar offers H2/H3
      heading: { levels: [1, 2, 3, 4, 5, 6] },
      link: {
        openOnClick: false,
        autolink: true,
        protocols: ["http", "https", "mailto"],
        HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" },
      },
    }),
    Image.configure({ allowBase64: false }),
  ];
}

export function emptyDocument(): { type: "doc"; content: unknown[] } {
  return { type: "doc", content: [{ type: "paragraph" }] };
}
