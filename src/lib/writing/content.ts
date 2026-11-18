import { generateHTML, generateJSON } from "@tiptap/html/server";
import { getSchema } from "@tiptap/core";
import { Node as PMNode } from "@tiptap/pm/model";
import type { EditorJSON } from "@/lib/db/schema";
import { sanitizePostHtml } from "@/lib/content/sanitize";
import { documentExtensions } from "./extensions";
import { summarizeText } from "./text";

const extensions = documentExtensions();
const schema = getSchema(extensions);

export class InvalidDocumentError extends Error {}

/** Parse and check document JSON against the editor schema. Throws InvalidDocumentError. */
export function parseDocument(json: unknown): PMNode {
  try {
    const node = PMNode.fromJSON(schema, json);
    node.check();
    if (node.type.name !== "doc") throw new Error("Root node must be a doc");
    return node;
  } catch (error) {
    throw new InvalidDocumentError(error instanceof Error ? error.message : "Invalid document");
  }
}

/** Plain text and word count, for search and the list view. */
export function documentStats(json: unknown): { text: string; wordCount: number } {
  const node = parseDocument(json);
  const text = node.textBetween(0, node.content.size, "\n", " ");
  return summarizeText(text);
}

/** Convert legacy post HTML into editor JSON (used when importing old posts). */
export function htmlToDocument(html: string | null | undefined): EditorJSON {
  const json = generateJSON(sanitizePostHtml(html) || "<p></p>", extensions) as EditorJSON;
  parseDocument(json);
  return json;
}

/** Render editor JSON to the sanitized HTML that public pages display. */
export function documentToHtml(json: EditorJSON): string {
  return sanitizePostHtml(generateHTML(json as Parameters<typeof generateHTML>[0], extensions));
}

/** Split a document into sections at its headings (text before the first heading is an untitled section). */
export function documentSections(json: unknown): Array<{ heading: string; text: string }> {
  const node = parseDocument(json);
  const sections: Array<{ heading: string; text: string }> = [];
  let current = { heading: "", text: "" };
  node.forEach((child) => {
    if (child.type.name === "heading") {
      if (current.heading || current.text.trim()) sections.push(current);
      current = { heading: child.textContent.trim(), text: "" };
    } else {
      const text = child.textBetween(0, child.content.size, "\n", " ").trim();
      if (text) current.text += (current.text ? "\n" : "") + text;
    }
  });
  if (current.heading || current.text.trim()) sections.push(current);
  return sections;
}
