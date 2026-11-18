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

/**
 * Find a quoted passage in the document (case- and whitespace-insensitive,
 * within one paragraph or heading). Used to jump to review findings.
 */
export function findTextRange(doc: EditorState["doc"], quote: string): { from: number; to: number } | null {
  const target = quote.replace(/\s+/g, " ").trim().replace(/^["“']|["”']$/g, "").toLowerCase();
  if (target.length < 2) return null;
  let found: { from: number; to: number } | null = null;
  doc.descendants((node, pos) => {
    if (found) return false;
    if (!node.isTextblock) return true;
    let text = "";
    const map: number[] = [];
    node.forEach((child, offset) => {
      if (child.isText && child.text) {
        for (let i = 0; i < child.text.length; i++) {
          text += child.text[i];
          map.push(pos + 1 + offset + i);
        }
      } else {
        text += " ";
        map.push(pos + 1 + offset);
      }
    });
    let norm = "";
    const normMap: number[] = [];
    let prevSpace = true;
    for (let i = 0; i < text.length; i++) {
      const ch = /\s/.test(text[i]) ? " " : text[i];
      if (ch === " " && prevSpace) continue;
      prevSpace = ch === " ";
      norm += ch;
      normMap.push(map[i]);
    }
    const index = norm.toLowerCase().indexOf(target);
    if (index >= 0) found = { from: normMap[index], to: normMap[index + target.length - 1] + 1 };
    return false;
  });
  return found;
}
