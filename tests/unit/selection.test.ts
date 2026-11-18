import { describe, expect, it } from "vitest";
import { getSchema } from "@tiptap/core";
import { EditorState } from "@tiptap/pm/state";
import { Node } from "@tiptap/pm/model";
import { documentExtensions } from "@/lib/writing/extensions";
import { trimSelection } from "@/lib/writing/selection";

const schema = getSchema(documentExtensions());
const doc = Node.fromJSON(schema, {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Title" }] },
    { type: "paragraph", content: [{ type: "text", text: "Second" }] },
    { type: "paragraph", content: [{ type: "text", text: "Third" }] },
  ],
});
const state = EditorState.create({ doc, schema });
// Positions: heading text 1..6, paragraph "Second" 8..14, "Third" 16..21
const text = (r: { from: number; to: number }) => state.doc.textBetween(r.from, r.to, "|");

describe("trimSelection", () => {
  it("drops the next block when the selection only touches its start (triple-click)", () => {
    const r = trimSelection(state, 1, 8);
    expect(text(r)).toBe("Title");
    expect(state.doc.resolve(r.from).sameParent(state.doc.resolve(r.to))).toBe(true);
  });

  it("drops the previous block when the selection starts at its very end", () => {
    expect(text(trimSelection(state, 6, 14))).toBe("Second");
  });

  it("keeps genuine multi-block selections", () => {
    expect(text(trimSelection(state, 3, 11))).toBe("tle|Sec");
  });

  it("leaves selections within one block alone", () => {
    expect(trimSelection(state, 9, 12)).toEqual({ from: 9, to: 12 });
  });

  it("handles selections spanning three blocks that end at a block start", () => {
    expect(text(trimSelection(state, 1, 16))).toBe("Title|Second");
  });
});
