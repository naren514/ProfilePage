import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, type EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

// Highlights the passage an AI suggestion is about. ProseMirror maps the
// decoration through every edit, so the range keeps pointing at the same text
// while the author keeps typing elsewhere.

export const suggestionHighlightKey = new PluginKey<DecorationSet>("suggestionHighlight");

type Meta = { set: { from: number; to: number } } | { clear: true };

export const SuggestionHighlight = Extension.create({
  name: "suggestionHighlight",
  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: suggestionHighlightKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, set) {
            const meta = tr.getMeta(suggestionHighlightKey) as Meta | undefined;
            if (meta && "clear" in meta) return DecorationSet.empty;
            if (meta && "set" in meta) {
              const { from, to } = meta.set;
              return DecorationSet.create(tr.doc, [
                Decoration.inline(from, to, { class: "ai-suggestion-target" }, { inclusiveStart: false, inclusiveEnd: false }),
              ]);
            }
            return set.map(tr.mapping, tr.doc);
          },
        },
        props: {
          decorations: (state) => suggestionHighlightKey.getState(state),
        },
      }),
    ];
  },
});

/** The highlighted range, or null if it was deleted. */
export function highlightedRange(state: EditorState): { from: number; to: number } | null {
  const set = suggestionHighlightKey.getState(state);
  const found = set?.find() ?? [];
  if (found.length === 0) return null;
  return { from: Math.min(...found.map((d) => d.from)), to: Math.max(...found.map((d) => d.to)) };
}
