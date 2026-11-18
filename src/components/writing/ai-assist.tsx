"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { getHTMLFromFragment } from "@tiptap/core";
import { Check, ChevronDown, Loader2, RotateCcw, Sparkles, Square, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { highlightedRange, suggestionHighlightKey } from "@/lib/writing/suggestion-highlight";
import { trimSelection } from "@/lib/writing/selection";
import { readRewriteStream, type ContextSummary } from "./ai-stream";
import { WordDiff, diffStats } from "./word-diff";

export interface StyleOption {
  id: string;
  name: string;
  isDefault: boolean;
}

type OperationId = "improve" | "flow" | "shorten" | "expand" | "simplify" | "grammar" | "style" | "custom";

const PRIMARY: Array<{ id: OperationId; label: string }> = [
  { id: "improve", label: "Improve" },
  { id: "shorten", label: "Shorten" },
  { id: "expand", label: "Expand" },
  { id: "simplify", label: "Simplify" },
  { id: "grammar", label: "Fix grammar" },
];

const LABELS: Record<OperationId, string> = {
  improve: "Improve clarity",
  flow: "Improve flow",
  shorten: "Shorten",
  expand: "Expand",
  simplify: "Simplify",
  grammar: "Fix grammar",
  style: "Rewrite in style",
  custom: "Custom edit",
};

interface RunOptions {
  instruction?: string;
  styleId?: string;
  styleName?: string;
}

export interface Suggestion {
  operation: OperationId;
  label: string;
  styleName?: string;
  status: "streaming" | "ready" | "error";
  id?: string;
  kind: "inline" | "blocks";
  originalHtml: string;
  originalText: string;
  streamedText: string;
  proposalHtml?: string;
  proposalText?: string;
  context?: ContextSummary;
  error?: string;
  truncated?: boolean;
  costUsd?: number;
  options: RunOptions;
}

function htmlToText(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html.replace(/<\/(p|h[1-6]|li|blockquote)>/gi, "$&\n");
  return (div.textContent ?? "").replace(/\n{2,}/g, "\n").trim();
}

/** The selection, widened to whole blocks unless it sits inside one paragraph. */
function captureSelection(editor: Editor) {
  const { state } = editor;
  if (state.selection.empty) return null;
  const { from, to } = trimSelection(state, state.selection.from, state.selection.to);
  const $from = state.doc.resolve(from);
  const $to = state.doc.resolve(to);
  if (from >= to) return null;
  const inline = $from.sameParent($to) && $from.parent.isTextblock && !(from === $from.start() && to === $to.end());
  const range = inline ? { from, to } : { from: $from.before(1), to: $to.after(1) };
  const slice = state.doc.slice(range.from, range.to);
  const html = getHTMLFromFragment(slice.content, editor.schema);
  const text = state.doc.textBetween(range.from, range.to, "\n", " ");
  return {
    kind: (inline ? "inline" : "blocks") as "inline" | "blocks",
    range,
    html,
    text,
    before: state.doc.textBetween(Math.max(0, range.from - 4000), range.from, "\n", " "),
    after: state.doc.textBetween(range.to, Math.min(state.doc.content.size, range.to + 4000), "\n", " "),
  };
}

async function resolveOnServer(
  id: string | undefined,
  status: "accepted" | "modified" | "rejected" | "stale" | "cancelled",
  finalHtml?: string,
  reason?: string
) {
  if (!id) return;
  await fetch(`/api/admin/writing/ai/suggestions/${id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, finalHtml, reason }),
  }).catch(() => {});
}

function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** The author's edited version of a proposal, as HTML for the passage kind. */
export function editedTextToHtml(text: string, kind: "inline" | "blocks"): string {
  if (kind === "inline") return escapeHtml(text.replace(/\s*\n\s*/g, " ").trim());
  return text
    .split(/\n\s*\n|\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join("");
}

export const REJECT_REASONS = ["Lost my voice", "Changed the meaning", "Too formal", "Too casual", "Too long", "Not better"];

export function useAiAssist(params: {
  editor: Editor | null;
  documentId: string;
  getBaseRevision: () => number;
  /** Persist everything typed so far; false if saving failed. */
  saveNow: () => Promise<boolean>;
  /** Called after an accepted edit is in the document. */
  onAccepted: () => void;
}) {
  const { editor, documentId, getBaseRevision, saveNow, onAccepted } = params;
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const clearHighlight = useCallback(() => {
    if (!editor || editor.isDestroyed) return;
    editor.view.dispatch(editor.state.tr.setMeta(suggestionHighlightKey, { clear: true }));
  }, [editor]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const run = useCallback(
    async (operation: OperationId, options: RunOptions = {}, reuse?: Suggestion) => {
      if (!editor) return;
      let captured: ReturnType<typeof captureSelection>;
      if (reuse) {
        const range = highlightedRange(editor.state);
        if (!range) {
          toast.error("That passage was deleted, so there's nothing to retry on.");
          setSuggestion(null);
          return;
        }
        captured = {
          kind: reuse.kind,
          range,
          html: reuse.originalHtml,
          text: reuse.originalText,
          before: editor.state.doc.textBetween(Math.max(0, range.from - 4000), range.from, "\n", " "),
          after: editor.state.doc.textBetween(range.to, Math.min(editor.state.doc.content.size, range.to + 4000), "\n", " "),
        };
      } else {
        captured = captureSelection(editor);
      }
      if (!captured || !captured.text.trim()) {
        toast.error("Select some text first.");
        return;
      }

      abortRef.current?.abort();
      const abort = new AbortController();
      abortRef.current = abort;
      editor.view.dispatch(editor.state.tr.setMeta(suggestionHighlightKey, { set: captured.range }));

      const base: Suggestion = {
        operation,
        label: LABELS[operation],
        styleName: options.styleName,
        status: "streaming",
        kind: captured.kind,
        originalHtml: captured.html,
        originalText: captured.text,
        streamedText: "",
        options,
      };
      setSuggestion(base);

      try {
        const response = await fetch("/api/admin/writing/ai/rewrite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: abort.signal,
          body: JSON.stringify({
            documentId,
            baseRevision: getBaseRevision(),
            operation,
            instruction: options.instruction,
            styleId: options.styleId,
            passageKind: captured.kind,
            passageHtml: captured.html,
            contextBefore: captured.before,
            contextAfter: captured.after,
          }),
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error || `The AI request failed (${response.status}).`);
        }
        for await (const ev of readRewriteStream(response)) {
          if (ev.event === "meta") {
            setSuggestion((s) => (s ? { ...s, id: ev.data.suggestionId, context: ev.data.context } : s));
          } else if (ev.event === "delta") {
            setSuggestion((s) => (s ? { ...s, streamedText: s.streamedText + ev.data.text } : s));
          } else if (ev.event === "done") {
            setSuggestion((s) =>
              s
                ? {
                    ...s,
                    status: "ready",
                    id: ev.data.suggestionId,
                    proposalHtml: ev.data.proposalHtml,
                    proposalText: htmlToText(ev.data.proposalHtml),
                    truncated: ev.data.truncated,
                    costUsd: ev.data.costUsd,
                  }
                : s
            );
          } else if (ev.event === "error") {
            throw new Error(ev.data.message);
          }
        }
      } catch (error) {
        if (abort.signal.aborted) return;
        setSuggestion((s) => (s ? { ...s, status: "error", error: error instanceof Error ? error.message : "The AI request failed." } : s));
      }
    },
    [editor, documentId, getBaseRevision]
  );

  const dismiss = useCallback(
    (status: "rejected" | "cancelled" = "rejected", reason?: string) => {
      abortRef.current?.abort();
      if (suggestion?.id && suggestion.status === "ready") resolveOnServer(suggestion.id, status, undefined, reason);
      const range = editor ? highlightedRange(editor.state) : null;
      clearHighlight();
      setSuggestion(null);
      // Put the cursor after the passage rather than reselecting it (which would reopen the menu)
      if (editor && !editor.isDestroyed) {
        if (range) editor.chain().focus().setTextSelection(range.to).run();
        else editor.commands.focus();
      }
    },
    [suggestion, clearHighlight, editor]
  );

  /** Accept the proposal, or the author's edited version of it. */
  const accept = useCallback(async (editedText?: string) => {
    if (!editor || !suggestion?.proposalHtml) return;
    const modified = editedText !== undefined && editedText.trim() !== (suggestion.proposalText ?? "").trim();
    const html = modified ? editedTextToHtml(editedText!, suggestion.kind) : suggestion.proposalHtml;
    if (!html) return;
    const range = highlightedRange(editor.state);
    const current = range ? editor.state.doc.textBetween(range.from, range.to, "\n", " ") : null;
    // Reject if the passage changed since the suggestion was made
    if (!range || current !== suggestion.originalText) {
      toast.error("That passage changed after you asked, so the suggestion no longer fits. Try again on the new text.");
      resolveOnServer(suggestion.id, "stale");
      clearHighlight();
      setSuggestion(null);
      return;
    }
    // Make sure the text as it was before the edit is saved, so it can be restored
    if (!(await saveNow())) return;
    const latest = highlightedRange(editor.state);
    if (!latest) return;
    editor.chain().focus().insertContentAt(latest, html, { updateSelection: true }).run();
    clearHighlight();
    resolveOnServer(suggestion.id, modified ? "modified" : "accepted", html);
    setSuggestion(null);
    onAccepted();
    toast.success("Suggestion applied. Press Ctrl+Z to undo.");
  }, [editor, suggestion, saveNow, clearHighlight, onAccepted]);

  const retry = useCallback(() => {
    if (!suggestion) return;
    if (suggestion.id && suggestion.status === "ready") resolveOnServer(suggestion.id, "rejected");
    run(suggestion.operation, suggestion.options, suggestion);
  }, [suggestion, run]);

  return { suggestion, run, accept, dismiss, retry };
}

// ---------------------------------------------------------------------------
// Selection menu
// ---------------------------------------------------------------------------

export function AiBubbleMenu({
  editor,
  styles,
  disabled,
  onRun,
  onSaveSample,
}: {
  editor: Editor;
  styles: StyleOption[];
  disabled: boolean;
  onRun: (operation: OperationId, options?: RunOptions) => void;
  /** Save the selected text to the writing-samples library. */
  onSaveSample?: (text: string) => void;
}) {
  const [more, setMore] = useState(false);
  const [instruction, setInstruction] = useState("");
  // Tiptap re-sends menu options whenever these identities change, so keep them stable
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const shouldShow = useCallback(
    ({ editor: e, state, view, element }: { editor: Editor; state: Editor["state"]; view: Editor["view"]; element: HTMLElement }) =>
      !disabledRef.current &&
      e.isEditable &&
      !state.selection.empty &&
      // Text only: clicking an image selects it, which isn't something to rewrite
      state.doc.textBetween(state.selection.from, state.selection.to, " ").trim() !== "" &&
      // Stay open while typing a custom instruction inside the menu
      (view.hasFocus() || element.contains(document.activeElement)),
    []
  );
  const options = useMemo(() => ({ placement: "bottom-start" as const, offset: 8, onHide: () => setMore(false) }), []);

  const go = (operation: OperationId, options?: RunOptions) => {
    setMore(false);
    setInstruction("");
    onRun(operation, options);
  };

  return (
    <BubbleMenu
      editor={editor}
      shouldShow={shouldShow}
      options={options}
    >
      {/* The menu only re-checks visibility on selection changes, so render nothing while disabled */}
      {!disabled && (
      <div
        role="menu"
        aria-label="AI edits for the selected text"
        className="w-max max-w-[min(92vw,36rem)] rounded-2xl bg-neutral-900 p-1 text-neutral-100 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.45)] ring-1 ring-black/10"
      >
        <div className="flex flex-wrap items-center gap-0.5">
          <Sparkles className="mx-2 h-3.5 w-3.5 text-[hsl(252_90%_78%)]" aria-hidden />
          {PRIMARY.map((op) => (
            <button
              key={op.id}
              type="button"
              role="menuitem"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => go(op.id)}
              className="rounded-xl px-2.5 py-1.5 text-[13px] text-neutral-200 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              {op.label}
            </button>
          ))}
          <button
            type="button"
            aria-expanded={more}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setMore((m) => !m)}
            className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-[13px] text-neutral-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            More
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", more && "rotate-180")} aria-hidden />
          </button>
        </div>
        {more && (
          <div className="mt-1 space-y-2 border-t border-white/10 p-2">
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                role="menuitem"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => go("flow")}
                className="rounded-full bg-white/[0.07] px-2.5 py-1 text-xs text-neutral-200 transition-colors hover:bg-white/15 hover:text-white"
              >
                Improve flow
              </button>
              {styles.map((style) => (
                <button
                  key={style.id}
                  type="button"
                  role="menuitem"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => go("style", { styleId: style.id, styleName: style.name })}
                  className="rounded-full bg-white/[0.07] px-2.5 py-1 text-xs text-neutral-200 transition-colors hover:bg-white/15 hover:text-white"
                >
                  Rewrite as {style.name}
                </button>
              ))}
              {onSaveSample && (
                <button
                  type="button"
                  role="menuitem"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    const { from, to } = editor.state.selection;
                    setMore(false);
                    onSaveSample(editor.state.doc.textBetween(from, to, "\n\n", " "));
                  }}
                  className="rounded-full border border-dashed border-white/25 px-2.5 py-1 text-xs text-neutral-300 transition-colors hover:bg-white/10 hover:text-white"
                >
                  Save as writing sample
                </button>
              )}
            </div>
            <form
              className="flex gap-1"
              onSubmit={(e) => {
                e.preventDefault();
                if (instruction.trim()) go("custom", { instruction: instruction.trim() });
              }}
            >
              <label htmlFor="ai-custom" className="sr-only">
                Custom instruction
              </label>
              <input
                id="ai-custom"
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="Or say what to change, e.g. 'make it more direct'"
                maxLength={1000}
                className="h-8 flex-1 rounded-xl bg-white/[0.08] px-3 text-sm text-white placeholder:text-neutral-400 focus:bg-white/[0.12] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
              />
              <Button type="submit" size="sm" className="h-8 rounded-xl bg-white text-neutral-900 hover:bg-neutral-200" disabled={!instruction.trim()}>
                Go
              </Button>
            </form>
          </div>
        )}
      </div>
      )}
    </BubbleMenu>
  );
}

// ---------------------------------------------------------------------------
// Review panel
// ---------------------------------------------------------------------------

export function SuggestionPanel({
  suggestion,
  onAccept,
  onReject,
  onRetry,
}: {
  suggestion: Suggestion;
  onAccept: (editedText?: string) => void | Promise<void>;
  onReject: (reason?: string) => void;
  onRetry: () => void;
}) {
  const [accepting, setAccepting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [edited, setEdited] = useState("");
  const [askingWhy, setAskingWhy] = useState(false);
  const [otherReason, setOtherReason] = useState("");
  const stats = suggestion.proposalText ? diffStats(suggestion.originalText, suggestion.proposalText) : null;
  const heading = suggestion.styleName ? `${suggestion.label}: ${suggestion.styleName}` : suggestion.label;

  return (
    <section aria-label="AI suggestion" className="overflow-hidden rounded-2xl bg-background shadow-[0_1px_2px_rgba(0,0,0,0.04),0_10px_30px_-16px_hsl(var(--ai)/0.45)] ring-1 ring-ai/25">
      <header className="flex items-center justify-between gap-2 border-b border-ai/15 bg-ai-soft/70 px-4 py-2.5">
        <h2 className="flex items-center gap-2 text-[13px] font-medium">
          <Sparkles className="h-3.5 w-3.5 text-ai" aria-hidden />
          {heading}
        </h2>
        <button type="button" aria-label="Close suggestion" onClick={() => onReject()} className="rounded-sm p-1 text-muted-foreground hover:bg-muted">
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="space-y-3 p-4" aria-live="polite">
        {suggestion.status === "streaming" && (
          <>
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Writing a suggestion… You can keep editing.
            </p>
            {suggestion.streamedText && (
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{htmlToText(suggestion.streamedText)}</p>
            )}
            <Button size="sm" variant="outline" onClick={() => onReject()}>
              <Square className="mr-1.5 h-3.5 w-3.5" /> Stop
            </Button>
          </>
        )}

        {suggestion.status === "error" && (
          <>
            <p role="alert" className="text-sm text-destructive">{suggestion.error}</p>
            <p className="text-xs text-muted-foreground">Your text is unchanged.</p>
            <div className="flex gap-2">
              <Button size="sm" onClick={onRetry}>
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Try again
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onReject()}>
                Close
              </Button>
            </div>
          </>
        )}

        {suggestion.status === "ready" && suggestion.proposalText !== undefined && askingWhy && (
          <div className="space-y-2" role="group" aria-label="Why reject it?">
            <p className="text-sm">What was wrong with it? <span className="text-xs text-muted-foreground">(optional, helps the AI learn your style)</span></p>
            <div className="flex flex-wrap gap-1.5">
              {REJECT_REASONS.map((reason) => (
                <Button key={reason} size="sm" variant="outline" className="h-7 text-xs" onClick={() => onReject(reason)}>
                  {reason}
                </Button>
              ))}
            </div>
            <form
              className="flex gap-1"
              onSubmit={(e) => {
                e.preventDefault();
                onReject(otherReason.trim() || undefined);
              }}
            >
              <label htmlFor="reject-reason" className="sr-only">
                Other reason
              </label>
              <input
                id="reject-reason"
                value={otherReason}
                onChange={(e) => setOtherReason(e.target.value)}
                maxLength={300}
                placeholder="Something else…"
                className="h-7 flex-1 rounded-md border bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <Button type="submit" size="sm" variant="ghost" className="h-7 text-xs">
                {otherReason.trim() ? "Reject" : "Skip"}
              </Button>
            </form>
          </div>
        )}

        {suggestion.status === "ready" && suggestion.proposalText !== undefined && !askingWhy && editing && (
          <div className="space-y-2">
            <label htmlFor="edit-suggestion" className="text-xs font-medium">
              Edit the suggestion before it goes in
            </label>
            <textarea
              id="edit-suggestion"
              value={edited}
              onChange={(e) => setEdited(e.target.value)}
              rows={Math.min(12, Math.max(3, edited.split("\n").length + 1))}
              className="w-full rounded-md border bg-background p-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <p className="text-[11px] text-muted-foreground">Edited text goes in as plain paragraphs (formatting in the suggestion is dropped).</p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={accepting || !edited.trim()}
                onClick={async () => {
                  setAccepting(true);
                  try {
                    await onAccept(edited);
                  } finally {
                    setAccepting(false);
                  }
                }}
              >
                <Check className="mr-1.5 h-3.5 w-3.5" /> Accept edited
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Back
              </Button>
            </div>
          </div>
        )}

        {suggestion.status === "ready" && suggestion.proposalText !== undefined && !askingWhy && !editing && (
          <>
            <WordDiff before={suggestion.originalText} after={suggestion.proposalText} />
            {stats && (
              <p className="text-xs text-muted-foreground">
                {stats.beforeWords} → {stats.afterWords} words
                {suggestion.truncated ? " · cut off at the length limit" : ""}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-1.5 [&_button]:h-8 [&_button]:rounded-full [&_button]:px-3 [&_button]:text-xs">
              <Button
                size="sm"
                disabled={accepting}
                onClick={async () => {
                  setAccepting(true);
                  try {
                    await onAccept();
                  } finally {
                    setAccepting(false);
                  }
                }}
              >
                {accepting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}
                Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEdited(suggestion.proposalText ?? "");
                  setEditing(true);
                }}
              >
                Edit
              </Button>
              <Button size="sm" variant="outline" onClick={() => setAskingWhy(true)}>
                Reject
              </Button>
              <Button size="sm" variant="ghost" onClick={onRetry}>
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Try again
              </Button>
            </div>
          </>
        )}

        {suggestion.context && (
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">What the AI saw</summary>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              <dt className="text-muted-foreground">Model</dt>
              <dd className="break-all">{suggestion.context.model} ({suggestion.context.tier})</dd>
              <dt className="text-muted-foreground">Style</dt>
              <dd>{suggestion.context.style ? `${suggestion.context.style.name} (v${suggestion.context.style.version})` : "None"}</dd>
              <dt className="text-muted-foreground">Examples</dt>
              <dd>{suggestion.context.examples.length ? suggestion.context.examples.join(", ") : "None"}</dd>
              <dt className="text-muted-foreground">Text sent</dt>
              <dd>
                {suggestion.context.passageWords} selected words, plus {suggestion.context.contextBeforeWords} before and{" "}
                {suggestion.context.contextAfterWords} after for context
              </dd>
              <dt className="text-muted-foreground">Prompt</dt>
              <dd className="break-all">{suggestion.context.promptVersion}</dd>
              {suggestion.costUsd !== undefined && (
                <>
                  <dt className="text-muted-foreground">Cost</dt>
                  <dd>${suggestion.costUsd.toFixed(4)}</dd>
                </>
              )}
            </dl>
            <details className="mt-2">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Full prompt</summary>
              <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-muted/50 p-2 text-[11px] leading-snug">
                {suggestion.context.messages.map((m) => `## ${m.role}\n${m.content}`).join("\n\n")}
              </pre>
            </details>
          </details>
        )}
      </div>
    </section>
  );
}
