import { Selection, type EditorState } from "@tiptap/pm/state";

/**
 * Trim a selection that merely touches a neighbouring block. Triple-clicking a
 * paragraph, for example, makes the browser select up to the start of the next
 * one, which would otherwise pull that whole block into the rewrite.
 */
export function trimSelection(state: EditorState, from: number, to: number): { from: number; to: number } {
  let $from = state.doc.resolve(from);
  let $to = state.doc.resolve(to);
  while ($to.pos > $from.pos && $to.parentOffset === 0 && !$from.sameParent($to)) {
    const before = Selection.findFrom(state.doc.resolve($to.before()), -1, true);
    if (!before || before.$head.pos <= $from.pos) break;
    $to = before.$head;
  }
  while ($from.pos < $to.pos && $from.parent.isTextblock && $from.parentOffset === $from.parent.content.size && !$from.sameParent($to)) {
    const next = Selection.findFrom(state.doc.resolve($from.after()), 1, true);
    if (!next || next.$head.pos >= $to.pos) break;
    $from = next.$head;
  }
  return { from: $from.pos, to: $to.pos };
}
