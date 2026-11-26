"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import Placeholder from "@tiptap/extension-placeholder";
import {
  ArrowLeft,
  ArrowUpRight,
  ClipboardCheck,
  Eye,
  FileText,
  History,
  ListTree,
  Loader2,
  Lock,
  Maximize2,
  MessageSquare,
  MoreHorizontal,
  PanelRight,
  Save,
  Search,
  Send,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { generateSlug } from "@/lib/content/slug";
import { AutosaveController, type AutosaveSnapshot, type SaveFn } from "@/lib/writing/autosave";
import { documentExtensions } from "@/lib/writing/extensions";
import { countWords } from "@/lib/writing/text";
import { EditorToolbar } from "./editor-toolbar";
import { PublishDialog } from "./publish-dialog";
import { SetupCard } from "./setup-card";
import { StatusDot } from "./studio-ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AssistantPanel, type AssistantControl } from "./agent/assistant-panel";
import { CommandPalette, type PaletteCommand } from "./command-palette";
import { cn } from "@/lib/utils";
import type { EditorActions } from "./agent/run-view";
import { findTextRange } from "@/lib/writing/selection";
import { AiBubbleMenu, SuggestionPanel, useAiAssist, type StyleOption } from "./ai-assist";
import { SuggestionHighlight } from "@/lib/writing/suggestion-highlight";
import { VersionsSheet } from "./versions-sheet";
import { StudioApiError, studioFetch, type LiveInfo, type StudioDocument } from "./client";

// ---------------------------------------------------------------------------
// Crash backup: unsaved work is mirrored to this browser until the server has it
// ---------------------------------------------------------------------------

interface Fields {
  title: string;
  excerpt: string;
  slug: string;
  tags: string[];
  postDate: string;
  /** "" means the default style */
  styleId: string;
}

interface Backup extends Fields {
  baseRevision: number;
  savedAt: number;
  bodyJson: unknown;
}

const backupKey = (id: string) => `writing-studio:backup:${id}`;

function readBackup(id: string): Backup | null {
  try {
    const raw = localStorage.getItem(backupKey(id));
    return raw ? (JSON.parse(raw) as Backup) : null;
  } catch {
    return null;
  }
}

function writeBackup(id: string, backup: Backup) {
  try {
    localStorage.setItem(backupKey(id), JSON.stringify(backup));
  } catch {
    // Storage full or blocked: autosave still protects the work
  }
}

function clearBackup(id: string) {
  try {
    localStorage.removeItem(backupKey(id));
  } catch {
    // ignore
  }
}

function contentKey(f: Omit<Fields, "styleId"> & { bodyJson: unknown }) {
  return JSON.stringify([f.title, f.excerpt, f.slug, f.tags, f.postDate, f.bodyJson]);
}

// ---------------------------------------------------------------------------
// Page: loads the document, then mounts a fresh editor for it
// ---------------------------------------------------------------------------

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; doc: StudioDocument; key: number }
  | { kind: "setup" }
  | { kind: "error"; message: string };

export function StudioEditorPage({ id }: { id: string }) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  const load = useCallback(async () => {
    try {
      const doc = await studioFetch<StudioDocument>(`/documents/${id}`);
      setState({ kind: "ready", doc, key: Date.now() });
    } catch (e) {
      if (e instanceof StudioApiError && e.code === "SETUP_REQUIRED") setState({ kind: "setup" });
      else setState({ kind: "error", message: e instanceof Error ? e.message : "Couldn't load this document" });
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (state.kind === "loading") {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin" aria-label="Loading document" />
      </div>
    );
  }
  if (state.kind === "setup") return <SetupCard onReady={load} />;
  if (state.kind === "error") {
    return (
      <div className="space-y-4">
        <p role="alert">{state.message}</p>
        <Button asChild variant="outline">
          <Link href="/admin/stories">Back to Thoughts</Link>
        </Button>
      </div>
    );
  }
  return <StudioEditor key={state.key} initial={state.doc} reload={load} />;
}

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------

interface Meta {
  status: string;
  publishedRevision: number | null;
  live: LiveInfo | null;
  liveChangedOutside: boolean;
}

function makeSaver(id: string): SaveFn {
  return async (changes, baseRevision, snapshot) => {
    try {
      const res = await studioFetch<{ currentRevision: number }>(`/documents/${id}`, {
        method: "PATCH",
        json: { ...changes, baseRevision, ...(snapshot ? { snapshot } : {}) },
      });
      return { ok: true, revision: res.currentRevision };
    } catch (e) {
      if (e instanceof StudioApiError) {
        if (e.status === 409) return { ok: false, kind: "conflict", message: e.message };
        if (e.status === 401) {
          return { ok: false, kind: "error", message: "Your login expired. Log in again in another tab; saving will resume.", retryable: true };
        }
        if (e.status === 400 || e.status === 404 || e.status === 422) {
          return { ok: false, kind: "error", message: e.message, retryable: false };
        }
        return { ok: false, kind: "error", message: e.message, retryable: true };
      }
      return { ok: false, kind: "error", message: "You seem to be offline. Your changes are kept and will be saved when you're back.", retryable: true };
    }
  };
}

const PANEL_MIN = 280;
const PANEL_MAX = 960;
/** Keep the panel between 280px and the smaller of 960px or 70% of the window. */
function clampPanel(width: number) {
  const max = typeof window === "undefined" ? PANEL_MAX : Math.min(PANEL_MAX, Math.floor(window.innerWidth * 0.7));
  return Math.max(PANEL_MIN, Math.min(max, width));
}

/**
 * The side panel's left edge: drag to resize, double-click to go back to the
 * automatic width. Also works from the keyboard (arrows, Home/End, Enter).
 */
function PanelResizer({ width, fallback, onChange }: { width: number | null; fallback: number; onChange: (width: number | null) => void }) {
  const [dragging, setDragging] = useState(false);
  const current = width ?? fallback;

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = (e.currentTarget.parentElement?.getBoundingClientRect().width ?? current) | 0;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const move = (ev: PointerEvent) => onChange(startWidth + (startX - ev.clientX));
    const up = () => {
      setDragging(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 96 : 32;
    if (e.key === "ArrowLeft") onChange(current + step);
    else if (e.key === "ArrowRight") onChange(current - step);
    else if (e.key === "Home") onChange(PANEL_MIN);
    else if (e.key === "End") onChange(PANEL_MAX);
    else if (e.key === "Enter") onChange(null);
    else return;
    e.preventDefault();
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize side panel"
      aria-valuenow={Math.round(current)}
      aria-valuemin={PANEL_MIN}
      aria-valuemax={PANEL_MAX}
      tabIndex={0}
      title="Drag to resize · double-click to reset"
      onPointerDown={onPointerDown}
      onDoubleClick={() => onChange(null)}
      onKeyDown={onKeyDown}
      className="group/resize sticky top-0 z-30 max-lg:hidden -mb-[calc(100vh-3.5rem)] -ml-px h-[calc(100vh-3.5rem)] w-3 cursor-col-resize touch-none focus-visible:outline-none"
    >
      <span
        aria-hidden
        className={cn(
          "absolute left-0 top-0 h-full w-px transition-colors",
          dragging ? "w-0.5 bg-ai" : "bg-transparent group-hover/resize:w-0.5 group-hover/resize:bg-ai/60 group-focus-visible/resize:w-0.5 group-focus-visible/resize:bg-ai"
        )}
      />
      <span
        aria-hidden
        className={cn(
          "absolute left-1 top-1/2 h-8 w-1 -translate-y-1/2 rounded-full bg-border transition-opacity",
          dragging ? "opacity-100" : "opacity-0 group-hover/resize:opacity-100 group-focus-visible/resize:opacity-100"
        )}
      />
    </div>
  );
}

function SaveIndicator({ save }: { save: AutosaveSnapshot }) {
  const [label, dot, tone] = (() => {
    switch (save.state) {
      case "saving":
        return ["Saving…", "bg-muted-foreground/60 animate-pulse", "text-muted-foreground"];
      case "dirty":
        return ["Unsaved changes", "bg-amber-500", "text-muted-foreground"];
      case "error":
        return ["Not saved, retrying", "bg-destructive", "text-destructive"];
      case "conflict":
        return ["Not saved: edit conflict", "bg-destructive", "text-destructive"];
      default:
        return ["Saved", "bg-emerald-500", "text-muted-foreground"];
    }
  })();
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${tone}`} role="status" aria-live="polite" title={save.message ?? undefined}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden />
      {label}
    </span>
  );
}

/** A textarea that grows with its content (titles and excerpts wrap instead of scrolling). */
function AutoGrowTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [props.value]);
  return <textarea ref={ref} {...props} />;
}

/** A labelled group in the side panel. */
function Field({ label, htmlFor, action, children }: { label: string; htmlFor: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={htmlFor} className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </Label>
        {action && <span className="text-xs text-muted-foreground">{action}</span>}
      </div>
      {children}
    </div>
  );
}

function Banner({ tone, children }: { tone: "warning" | "info"; children: React.ReactNode }) {
  return (
    <div
      role={tone === "warning" ? "alert" : "status"}
      className={
        tone === "warning"
          ? "flex flex-wrap items-center gap-3 rounded-xl bg-destructive/[0.06] px-4 py-3 text-sm text-destructive ring-1 ring-destructive/20"
          : "flex flex-wrap items-center gap-3 rounded-xl bg-muted/60 px-4 py-3 text-sm ring-1 ring-border"
      }
    >
      {children}
    </div>
  );
}

function StudioEditor({ initial, reload }: { initial: StudioDocument; reload: () => Promise<void> }) {
  const router = useRouter();
  const id = initial.id;

  const [fields, setFields] = useState<Fields>({
    title: initial.title,
    excerpt: initial.excerpt,
    slug: initial.slug ?? "",
    tags: initial.tags ?? [],
    postDate: initial.postDate ?? "",
    styleId: initial.styleId ?? "",
  });
  const fieldsRef = useRef(fields);
  fieldsRef.current = fields;

  const [meta, setMeta] = useState<Meta>({
    status: initial.status,
    publishedRevision: initial.publishedRevision,
    live: initial.live,
    liveChangedOutside: initial.liveChangedOutside,
  });
  const [save, setSave] = useState<AutosaveSnapshot>({
    state: "saved",
    baseRevision: initial.currentRevision,
    message: null,
    lastSavedAt: null,
  });
  const [wordCount, setWordCount] = useState(initial.wordCount);
  const [slugUnlocked, setSlugUnlocked] = useState(false);
  const [recovery, setRecovery] = useState<Backup | null>(null);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [tagDraft, setTagDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [styles, setStyles] = useState<StyleOption[]>([]);
  const [aiStatus, setAiStatus] = useState<{ available: boolean; reason?: string } | null>(null);

  // Writing styles and whether AI can be used (the editor works fully without it)
  useEffect(() => {
    studioFetch<{ styles: StyleOption[] }>("/styles")
      .then((d) => setStyles(d.styles))
      .catch(() => setStyles([]));
    studioFetch<{ settings: { enabled: boolean }; providerConfigured: boolean }>("/ai/settings")
      .then((d) =>
        setAiStatus(
          !d.providerConfigured
            ? { available: false, reason: "AI isn't set up on the server (OPENAI_API_KEY is missing)." }
            : !d.settings.enabled
              ? { available: false, reason: "AI is turned off in Styles & AI." }
              : { available: true }
        )
      )
      .catch(() => setAiStatus({ available: false, reason: "AI settings couldn't be loaded." }));
  }, []);

  const controllerRef = useRef<AutosaveController | null>(null);
  const backupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const manualSaveToast = useRef(false);
  const publishKey = useRef<string>("");

  const extensions = useMemo(
    () => [...documentExtensions(), Placeholder.configure({ placeholder: "Start writing…" }), SuggestionHighlight],
    []
  );

  const scheduleBackup = useCallback(() => {
    if (backupTimer.current) clearTimeout(backupTimer.current);
    backupTimer.current = setTimeout(() => {
      const editorJson = editorRef.current?.getJSON();
      if (!editorJson || !controllerRef.current?.hasUnsavedChanges()) return;
      writeBackup(id, {
        ...fieldsRef.current,
        bodyJson: editorJson,
        baseRevision: controllerRef.current.state.baseRevision,
        savedAt: Date.now(),
      });
    }, 600);
  }, [id]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    content: initial.bodyJson as JSONContent,
    editorProps: {
      attributes: {
        class: "studio-prose min-h-[50vh] focus:outline-none",
        "aria-label": "Post body",
      },
    },
    onUpdate: ({ editor: e }) => {
      controllerRef.current?.update({ bodyJson: () => e.getJSON() });
      setWordCount(countWords(e.getText()));
      scheduleBackup();
    },
  });
  const editorRef = useRef(editor);
  editorRef.current = editor;

  // One autosave engine per mounted document (recreated under React strict mode)
  useEffect(() => {
    const controller = new AutosaveController({
      baseRevision: initial.currentRevision,
      save: makeSaver(id),
      onChange: setSave,
    });
    controllerRef.current = controller;
    return () => {
      controller.dispose();
      if (controllerRef.current === controller) controllerRef.current = null;
    };
  }, [id, initial.currentRevision]);

  // Offer to recover unsaved work left in this browser
  useEffect(() => {
    const backup = readBackup(id);
    if (!backup) return;
    const serverKey = contentKey({
      title: initial.title,
      excerpt: initial.excerpt,
      slug: initial.slug ?? "",
      tags: initial.tags ?? [],
      postDate: initial.postDate ?? "",
      bodyJson: initial.bodyJson,
    });
    if (contentKey(backup) === serverKey) clearBackup(id);
    else setRecovery(backup);
  }, [id, initial]);

  // Once everything is acknowledged, the browser copy is no longer needed
  useEffect(() => {
    if (save.state === "saved" && !controllerRef.current?.hasUnsavedChanges()) {
      clearBackup(id);
      if (manualSaveToast.current) {
        manualSaveToast.current = false;
        toast.success("Version saved");
      }
    }
  }, [save.state, save.baseRevision, id]);

  // Warn before leaving with unsaved work
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (controllerRef.current?.hasUnsavedChanges()) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const saveVersion = useCallback(() => {
    manualSaveToast.current = true;
    controllerRef.current?.flush({ snapshot: "manual" });
  }, []);

  // Ctrl+S / Cmd+S saves a version
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveVersion();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [saveVersion]);

  const change = (patch: Partial<Fields>) => {
    setFields((prev) => ({ ...prev, ...patch }));
    const payload: Record<string, unknown> = { ...patch };
    if ("slug" in patch) payload.slug = patch.slug || null;
    if ("postDate" in patch) payload.postDate = patch.postDate || null;
    if ("styleId" in patch) payload.styleId = patch.styleId || null;
    controllerRef.current?.update(payload);
    fieldsRef.current = { ...fieldsRef.current, ...patch };
    scheduleBackup();
  };

  const neverPublished = meta.publishedRevision === null && !meta.live?.isPublished;
  const slugLocked = Boolean(meta.live?.isPublished) && !slugUnlocked;

  const onTitle = (title: string) => {
    const patch: Partial<Fields> = { title };
    // Until first publish, the slug follows the title unless it was edited by hand
    if (neverPublished && (!fields.slug || fields.slug === generateSlug(fields.title))) {
      patch.slug = generateSlug(title);
    }
    change(patch);
  };

  /** Save everything now and resolve once the server has it. */
  const saveNow = useCallback(async (): Promise<boolean> => {
    const controller = controllerRef.current;
    if (!controller) return false;
    controller.flush();
    const started = Date.now();
    while (Date.now() - started < 20_000) {
      const { state } = controller.state;
      if (state === "conflict" || state === "error") {
        toast.error(controller.state.message ?? "Couldn't save your latest changes");
        return false;
      }
      if (state === "saved" && !controller.hasUnsavedChanges()) return true;
      await new Promise((r) => setTimeout(r, 100));
    }
    toast.error("Saving is taking too long. Check your connection and try again.");
    return false;
  }, []);

  const ai = useAiAssist({
    editor,
    documentId: id,
    getBaseRevision: () => controllerRef.current?.state.baseRevision ?? initial.currentRevision,
    saveNow,
    // The accepted text is saved straight away, as its own version
    onAccepted: () => controllerRef.current?.flush({ snapshot: "ai_accept" }),
  });

  const [sideTab, setSideTab] = useState("details");
  const [panelOpen, setPanelOpen] = useState(true);
  const [focusMode, setFocusMode] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const assistantControl = useRef<AssistantControl | null>(null);

  // Remember whether the side panel was open
  useEffect(() => {
    try {
      // Phones and narrow windows start with the writing surface; the panel opens on top when asked for
      if (localStorage.getItem("writing-studio:panel") === "closed" || window.matchMedia("(max-width: 1023px)").matches) setPanelOpen(false);
    } catch {
      // ignore
    }
  }, []);
  const togglePanel = useCallback(() => {
    setPanelOpen((open) => {
      try {
        localStorage.setItem("writing-studio:panel", open ? "closed" : "open");
      } catch {
        // ignore
      }
      return !open;
    });
  }, []);

  // Side panel width: dragged by the author, remembered; null = automatic
  const [panelWidth, setPanelWidthState] = useState<number | null>(null);
  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem("writing-studio:panel-width"));
      if (saved >= PANEL_MIN && saved <= PANEL_MAX) setPanelWidthState(saved);
    } catch {
      // ignore
    }
  }, []);
  const setPanelWidth = useCallback((width: number | null) => {
    const next = width === null ? null : Math.round(clampPanel(width));
    setPanelWidthState(next);
    try {
      if (next === null) localStorage.removeItem("writing-studio:panel-width");
      else localStorage.setItem("writing-studio:panel-width", String(next));
    } catch {
      // ignore
    }
  }, []);

  // ⌘K commands · ⌘\ side panel · ⌘. focus mode · Esc leaves focus mode
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      } else if (mod && e.key === "\\") {
        e.preventDefault();
        togglePanel();
      } else if (mod && e.key === ".") {
        e.preventDefault();
        setFocusMode((f) => !f);
      } else if (e.key === "Escape" && focusMode && !document.querySelector("[role=dialog]")) {
        setFocusMode(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [togglePanel, focusMode]);

  const openAssistant = (tab?: "workflows" | "chat" | "sources") => {
    setPanelOpen(true);
    setFocusMode(false);
    setSideTab("assistant");
    if (tab) setTimeout(() => assistantControl.current?.openTab(tab), 0);
  };
  const runWorkflow = (workflow: string, input?: Record<string, unknown>) => {
    openAssistant("workflows");
    setTimeout(() => assistantControl.current?.start(workflow, input), 0);
  };

  /** Add the selected passage to the writing-samples library, linked to this post's style. */
  const saveSample = async (text: string) => {
    if (text.trim().length < 20) {
      toast.error("Select at least a sentence or two to save as a sample.");
      return;
    }
    const styleId = fields.styleId || styles.find((st) => st.isDefault)?.id;
    try {
      await studioFetch("/samples", {
        method: "POST",
        json: { content: text.trim().slice(0, 6000), sourceDocumentId: id, styleIds: styleId ? [styleId] : [] },
      });
      toast.success("Saved to your writing samples", {
        action: { label: "View", onClick: () => window.open("/admin/stories/memory", "_blank") },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save the sample");
    }
  };
  const [pendingResearch, setPendingResearch] = useState<string | null>(null);

  // What workflows may do to the post: always through the editor, so every change is undoable
  const editorActions: EditorActions = {
    insertHtml: async (html, mode) => {
      if (!editor || !(await saveNow())) return false;
      if (mode === "replace") {
        editor.chain().focus().insertContentAt({ from: 0, to: editor.state.doc.content.size }, html).run();
      } else {
        editor.chain().insertContentAt(editor.state.doc.content.size, html).focus("end").run();
      }
      controllerRef.current?.flush({ snapshot: "ai_accept" });
      toast.success("Added to your post. Press Ctrl+Z to undo.");
      return true;
    },
    setMetadata: (meta) => {
      const patch: Partial<Fields> = {};
      if (meta.title) patch.title = meta.title;
      if (meta.excerpt) patch.excerpt = meta.excerpt;
      if (meta.tags) patch.tags = meta.tags;
      if (meta.slug && meta.slug !== fields.slug) {
        if (slugLocked) toast.message("The URL wasn't changed because the post is live. Use Change next to the URL if you mean to.");
        else patch.slug = meta.slug;
      }
      change(patch);
      setSideTab("details");
    },
    showQuote: (quote) => {
      if (!editor) return false;
      const range = findTextRange(editor.state.doc, quote);
      if (!range) return false;
      editor.chain().focus().setTextSelection(range).scrollIntoView().run();
      return true;
    },
    fixQuote: (quote, instruction) => {
      if (!editor) return;
      const range = findTextRange(editor.state.doc, quote);
      if (!range) {
        toast.error("That passage has changed, so it can't be found any more.");
        return;
      }
      editor.chain().focus().setTextSelection(range).scrollIntoView().run();
      ai.run("custom", { instruction: `Fix this problem an editor found: ${instruction}`.slice(0, 1000) });
    },
    research: (question) => setPendingResearch(question),
  };

  const refreshMeta = useCallback(async () => {
    const doc = await studioFetch<StudioDocument>(`/documents/${id}`);
    setMeta({
      status: doc.status,
      publishedRevision: doc.publishedRevision,
      live: doc.live,
      liveChangedOutside: doc.liveChangedOutside,
    });
  }, [id]);

  const uploadImage = async (file: File) => {
    if (!editor) return;
    if (file.size > 4 * 1024 * 1024) {
      toast.error("Images must be 4 MB or smaller.");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/admin/writing/media", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Upload failed");
      const alt = window.prompt("Describe this image for people using screen readers (alt text):", "") ?? "";
      editor.chain().focus().setImage({ src: data.url, alt: alt.trim() }).run();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const openPreview = async () => {
    // Open the tab synchronously so pop-up blockers allow it, then navigate once saved
    const tab = window.open("about:blank", "_blank");
    if (await saveNow()) {
      if (tab) tab.location.href = `/admin/stories/${id}/preview`;
      else window.location.href = `/admin/stories/${id}/preview`;
    } else {
      tab?.close();
    }
  };

  const openPublish = async () => {
    publishKey.current = crypto.randomUUID();
    setPublishOpen(true);
    // Lets an enabled "Fact-check when I open Publish" automation start (once per version)
    studioFetch(`/documents/${id}/publish-opened`, { method: "POST" }).catch(() => {});
  };

  const publish = async (confirmSlugChange: boolean) => {
    if (!(await saveNow())) return;
    try {
      const res = await studioFetch<{ url: string }>(`/documents/${id}/publish`, {
        method: "POST",
        json: {
          baseRevision: controllerRef.current!.state.baseRevision,
          idempotencyKey: publishKey.current,
          confirmSlugChange,
        },
      });
      setPublishOpen(false);
      setSlugUnlocked(false);
      toast.success("Published", { action: { label: "View", onClick: () => window.open(res.url, "_blank") } });
      await refreshMeta();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Publishing failed");
    }
  };

  const unpublish = async () => {
    if (!confirm("Take this post off the site? The draft and its history stay here.")) return;
    setBusy(true);
    try {
      await studioFetch(`/documents/${id}/unpublish`, { method: "POST" });
      toast.success("Unpublished. The post is no longer on the site.");
      await refreshMeta();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't unpublish");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm("Delete this draft and its version history? This can't be undone.")) return;
    try {
      controllerRef.current?.dispose();
      await studioFetch(`/documents/${id}`, { method: "DELETE" });
      clearBackup(id);
      toast.success("Draft deleted");
      router.push("/admin/stories");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete");
    }
  };

  const restoreVersion = async (revisionId: string) => {
    if (!(await saveNow())) return;
    try {
      await studioFetch(`/documents/${id}/restore`, {
        method: "POST",
        json: { revisionId, baseRevision: controllerRef.current!.state.baseRevision },
      });
      clearBackup(id);
      toast.success("Version restored. The previous text is still in the history.");
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't restore that version");
    }
  };

  const pullLive = async () => {
    if (!confirm("Replace this draft with the live post as it is now? The current draft stays in the version history.")) return;
    if (!(await saveNow())) return;
    try {
      await studioFetch(`/documents/${id}/pull-live`, {
        method: "POST",
        json: { baseRevision: controllerRef.current!.state.baseRevision },
      });
      clearBackup(id);
      toast.success("Draft updated from the live post");
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't load the live post");
    }
  };

  const applyRecovery = () => {
    if (!recovery || !editor) return;
    const { title, excerpt, slug, tags, postDate, bodyJson } = recovery;
    change({ title, excerpt, slug, tags, postDate });
    editor.commands.setContent(bodyJson as Parameters<typeof editor.commands.setContent>[0], { emitUpdate: true });
    setRecovery(null);
    toast.success("Recovered your unsaved changes");
  };

  const conflictKeepMine = async () => {
    try {
      const latest = await studioFetch<StudioDocument>(`/documents/${id}`);
      controllerRef.current?.resolveConflictWith(latest.currentRevision);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't reach the server");
    }
  };

  const conflictTakeTheirs = async () => {
    if (!confirm("Discard your unsaved changes in this tab and load the latest saved version?")) return;
    controllerRef.current?.discard(save.baseRevision);
    clearBackup(id);
    await reload();
  };

  const addTag = () => {
    const tag = tagDraft.trim().replace(/,$/, "");
    if (!tag || fields.tags.includes(tag) || fields.tags.length >= 20) return setTagDraft("");
    change({ tags: [...fields.tags, tag] });
    setTagDraft("");
  };

  const hasUnpublishedChanges = meta.publishedRevision !== null && save.baseRevision > meta.publishedRevision;
  const isLive = Boolean(meta.live?.isPublished);

  const readingMinutes = Math.max(1, Math.round(wordCount / 230));
  const showPanel = (panelOpen && !focusMode) || Boolean(ai.suggestion);

  const commands: PaletteCommand[] = [
    { id: "save", group: "Post", label: "Save a version", shortcut: "⌘S", icon: <Save className="h-4 w-4" />, run: saveVersion },
    { id: "preview", group: "Post", label: "Preview", icon: <Eye className="h-4 w-4" />, run: openPreview },
    { id: "publish", group: "Post", label: isLive ? "Update live post…" : "Publish…", icon: <Send className="h-4 w-4" />, run: openPublish, disabled: save.state === "conflict" },
    { id: "versions", group: "Post", label: "Version history", icon: <History className="h-4 w-4" />, run: () => setVersionsOpen(true) },
    ...(isLive && meta.live ? [{ id: "live", group: "Post", label: "View live post", icon: <ArrowUpRight className="h-4 w-4" />, run: () => window.open(`/thoughts/${meta.live!.slug}`, "_blank") }] : []),
    ...(aiStatus?.available
      ? [
          { id: "review", group: "Assistant", label: "Editorial review", keywords: ["critique", "feedback"], icon: <ClipboardCheck className="h-4 w-4" />, run: () => runWorkflow("review") },
          { id: "draft", group: "Assistant", label: "Write a draft from the outline", keywords: ["expand", "notes"], icon: <FileText className="h-4 w-4" />, run: () => runWorkflow("draft", { length: "medium" }) },
          { id: "outline", group: "Assistant", label: "Outline from my notes", keywords: ["structure", "idea"], icon: <ListTree className="h-4 w-4" />, run: () => runWorkflow("explore", { idea: (editor?.getText() ?? "").slice(0, 8000) }), disabled: (editor?.getText() ?? "").trim().split(/\s+/).length < 3 },
          { id: "publish-prep", group: "Assistant", label: "Prepare to publish", keywords: ["title", "excerpt", "tags", "seo"], icon: <Wand2 className="h-4 w-4" />, run: () => runWorkflow("publish_prep") },
          { id: "research", group: "Assistant", label: "Research a question…", keywords: ["sources", "facts", "web"], icon: <Search className="h-4 w-4" />, run: () => openAssistant("workflows") },
          { id: "chat", group: "Assistant", label: "Chat with your writing partner", icon: <MessageSquare className="h-4 w-4" />, run: () => openAssistant("chat") },
        ]
      : []),
    { id: "panel", group: "View", label: showPanel ? "Hide side panel" : "Show side panel", shortcut: "⌘\\", icon: <PanelRight className="h-4 w-4" />, run: togglePanel },
    { id: "panel-wide", group: "View", label: "Wide side panel", keywords: ["resize", "width", "bigger"], icon: <PanelRight className="h-4 w-4" />, run: () => { if (!panelOpen) togglePanel(); setPanelWidth(640); } },
    ...(panelWidth ? [{ id: "panel-reset", group: "View", label: "Reset side panel width", keywords: ["resize", "width"], icon: <PanelRight className="h-4 w-4" />, run: () => setPanelWidth(null) }] : []),
    { id: "focus", group: "View", label: focusMode ? "Leave focus mode" : "Focus mode", shortcut: "⌘.", icon: <Maximize2 className="h-4 w-4" />, run: () => setFocusMode((f) => !f) },
    { id: "styles", group: "Go to", label: "Styles & AI settings", icon: <Sparkles className="h-4 w-4" />, run: () => router.push("/admin/stories/styles") },
    { id: "back", group: "Go to", label: "All thoughts", icon: <ArrowLeft className="h-4 w-4" />, run: () => router.push("/admin/stories") },
  ];

  return (
    <div className={focusMode ? "fixed inset-0 z-40 overflow-y-auto bg-background" : "min-h-screen bg-background"}>
      <header
        className={cn(
          "studio-motion sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-transparent bg-background/80 px-2 backdrop-blur-md transition-opacity sm:gap-3 sm:px-5",
          focusMode ? "opacity-20 hover:opacity-100 focus-within:opacity-100" : "border-border/70"
        )}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5 rounded-full px-2.5 text-muted-foreground hover:text-foreground">
            <Link href="/admin/stories">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only sm:not-sr-only">Thoughts</span>
            </Link>
          </Button>
          <span className="hidden text-border sm:inline" aria-hidden>
            /
          </span>
          <span className="hidden max-w-[16rem] truncate font-serif text-[0.9375rem] md:inline">{fields.title || "Untitled"}</span>
          <StatusDot status={meta.status} unpublishedChanges={hasUnpublishedChanges} compact className="hidden shrink-0 whitespace-nowrap sm:flex" />
          <span className="hidden h-3 w-px bg-border sm:block" aria-hidden />
          <span className="whitespace-nowrap">
            <SaveIndicator save={save} />
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className={cn("mr-2 hidden whitespace-nowrap text-xs tabular-nums text-muted-foreground", showPanel ? "2xl:inline" : "xl:inline")} aria-live="off">
            {wordCount.toLocaleString()} words · {readingMinutes} min read
          </span>
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            aria-label="Commands"
            className="mr-1 hidden h-8 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-border/80 pl-3 pr-1.5 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground md:inline-flex"
          >
            <span className={showPanel ? "hidden 2xl:inline" : "hidden xl:inline"}>Commands</span> <kbd className="kbd">⌘K</kbd>
          </button>
          <Button variant="ghost" size="sm" className="h-9 rounded-full px-2.5 sm:h-8 sm:px-3" onClick={() => setVersionsOpen(true)} aria-label="Versions">
            <History className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Versions</span>
          </Button>
          <Button variant="ghost" size="sm" className="h-9 rounded-full px-2.5 sm:h-8 sm:px-3" onClick={openPreview} aria-label="Preview">
            <Eye className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Preview</span>
          </Button>
          <Button size="sm" className="ml-1 h-8 rounded-full px-4" onClick={openPublish} disabled={save.state === "conflict"}>
            {isLive ? (hasUnpublishedChanges ? "Update live post" : "Publish") : "Publish"}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" aria-label="More actions" disabled={busy}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 rounded-xl">
              {isLive && meta.live && (
                <DropdownMenuItem asChild>
                  <a href={`/thoughts/${meta.live.slug}`} target="_blank" rel="noreferrer">
                    View live post
                  </a>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={saveVersion}>Save version now</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setFocusMode((f) => !f)}>{focusMode ? "Leave focus mode" : "Focus mode"}</DropdownMenuItem>
              <DropdownMenuSeparator />
              {isLive ? (
                <DropdownMenuItem onSelect={unpublish}>Unpublish</DropdownMenuItem>
              ) : (
                <DropdownMenuItem onSelect={remove} className="text-destructive focus:text-destructive">
                  Delete draft
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-8 w-8 rounded-full", showPanel && "bg-muted")}
            aria-label={showPanel ? "Hide side panel" : "Show side panel"}
            aria-pressed={showPanel}
            title="Side panel (⌘\)"
            onClick={togglePanel}
          >
            <PanelRight className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="flex">
        <div className="min-w-0 flex-1 px-6">
          <div className="mx-auto max-w-[44rem] pb-48 pt-12">
            {(recovery || save.state === "conflict" || (save.state === "error" && save.message) || meta.liveChangedOutside) && (
              <div className="mb-10 space-y-3">
                {recovery && (
                  <Banner tone="info">
                    <span className="flex-1">
                      This browser has changes to this post that weren&apos;t saved (from {new Date(recovery.savedAt).toLocaleString()}).
                    </span>
                    <Button size="sm" className="h-8 rounded-full" onClick={applyRecovery}>
                      Recover them
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 rounded-full"
                      onClick={() => {
                        clearBackup(id);
                        setRecovery(null);
                      }}
                    >
                      Discard
                    </Button>
                  </Banner>
                )}
                {save.state === "conflict" && (
                  <Banner tone="warning">
                    <span className="flex-1">
                      This post was saved somewhere else (another tab or device) after you opened it, so your latest changes haven&apos;t been saved.
                    </span>
                    <Button size="sm" className="h-8 rounded-full" onClick={conflictKeepMine}>
                      Keep my version
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 rounded-full bg-background" onClick={conflictTakeTheirs}>
                      Load the other version
                    </Button>
                  </Banner>
                )}
                {save.state === "error" && save.message && (
                  <Banner tone="warning">
                    <span className="flex-1">{save.message}</span>
                  </Banner>
                )}
                {meta.liveChangedOutside && (
                  <Banner tone="info">
                    <span className="flex-1">
                      The live post was edited outside the Studio (in the classic editor). Publishing from here would replace those edits.
                    </span>
                    <Button size="sm" variant="outline" className="h-8 rounded-full bg-background" onClick={pullLive}>
                      Use the live version
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 rounded-full" onClick={() => setMeta((m) => ({ ...m, liveChangedOutside: false }))}>
                      Keep my draft
                    </Button>
                  </Banner>
                )}
              </div>
            )}

            <label htmlFor="doc-title" className="sr-only">
              Title
            </label>
            <AutoGrowTextarea
              id="doc-title"
              value={fields.title}
              onChange={(e) => onTitle(e.target.value.replace(/\n/g, " "))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  editor?.commands.focus("start");
                }
              }}
              placeholder="Title"
              rows={1}
              maxLength={200}
              className="w-full resize-none overflow-hidden bg-transparent font-serif text-[2.75rem] font-medium leading-[1.12] tracking-[-0.015em] placeholder:text-muted-foreground/35 focus:outline-none"
            />
            <label htmlFor="doc-excerpt" className="sr-only">
              Excerpt
            </label>
            <AutoGrowTextarea
              id="doc-excerpt"
              value={fields.excerpt}
              onChange={(e) => change({ excerpt: e.target.value.replace(/\n/g, " ") })}
              placeholder="A sentence or two for the Thoughts page…"
              rows={1}
              maxLength={1000}
              className="mt-4 w-full resize-none overflow-hidden bg-transparent font-serif text-xl italic leading-relaxed text-muted-foreground placeholder:text-muted-foreground/40 focus:outline-none"
            />

            <div
              className={cn(
                "studio-motion sticky top-[4.25rem] z-20 mx-auto mt-8 w-fit max-w-full rounded-full border border-border/70 bg-background/90 px-1.5 py-1 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_6px_20px_-10px_rgba(0,0,0,0.18)] backdrop-blur-md transition-opacity",
                focusMode && "opacity-0 hover:opacity-100 focus-within:opacity-100"
              )}
            >
              {editor && <EditorToolbar editor={editor} onUploadImage={uploadImage} uploading={uploading} />}
            </div>
            <div className="mt-10">
              <EditorContent editor={editor} />
              {editor && aiStatus?.available && (
                <AiBubbleMenu editor={editor} styles={styles} disabled={Boolean(ai.suggestion)} onRun={ai.run} onSaveSample={saveSample} />
              )}
            </div>
          </div>
        </div>

        <aside
          aria-label="Post details"
          style={showPanel && panelWidth ? { width: panelWidth } : undefined}
          className={cn(
            "sticky top-14 h-[calc(100vh-3.5rem)] max-w-[70vw] shrink-0 overflow-y-auto overflow-x-hidden border-l border-border/70 bg-muted/25 text-sm",
            // Narrow screens: the panel covers the page instead of squeezing the text
            "max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:top-14 max-lg:z-30 max-lg:!w-full max-lg:max-w-none max-lg:border-l-0 max-lg:bg-background",
            showPanel ? (panelWidth ? "" : ai.suggestion || sideTab === "assistant" ? "w-[25rem]" : "w-[20rem]") : "hidden"
          )}
        >
          {showPanel && (
            <PanelResizer
              width={panelWidth}
              fallback={ai.suggestion || sideTab === "assistant" ? 400 : 320}
              onChange={setPanelWidth}
            />
          )}
          <div className="space-y-5 p-5">
            {ai.suggestion && (
              <SuggestionPanel suggestion={ai.suggestion} onAccept={ai.accept} onReject={(reason) => ai.dismiss("rejected", reason)} onRetry={ai.retry} />
            )}

            <Tabs value={sideTab} onValueChange={setSideTab}>
              <TabsList className="grid h-9 w-full grid-cols-2 rounded-full bg-muted p-1">
                <TabsTrigger value="details" className="rounded-full text-xs data-[state=active]:shadow-sm">
                  Details
                </TabsTrigger>
                <TabsTrigger value="assistant" className="gap-1.5 rounded-full text-xs data-[state=active]:shadow-sm">
                  <Sparkles className="h-3 w-3 text-ai" aria-hidden />
                  Assistant
                </TabsTrigger>
              </TabsList>
              {/* Kept mounted so a running workflow or chat reply continues while Details is shown */}
              <TabsContent value="assistant" forceMount className="mt-5 data-[state=inactive]:hidden">
                <AssistantPanel
                  documentId={id}
                  actions={editorActions}
                  aiAvailable={Boolean(aiStatus?.available)}
                  aiReason={aiStatus?.reason}
                  getText={() => editor?.getText() ?? ""}
                  pendingResearch={pendingResearch}
                  onResearchTaken={() => setPendingResearch(null)}
                  controlRef={assistantControl}
                />
              </TabsContent>
              <TabsContent value="details" className="mt-6 space-y-7">
                <Field label="Writing style" htmlFor="doc-style" action={<Link href="/admin/stories/styles" className="hover:text-foreground">Edit styles</Link>}>
                  <select
                    id="doc-style"
                    value={fields.styleId}
                    onChange={(e) => change({ styleId: e.target.value })}
                    className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Default ({styles.find((st) => st.isDefault)?.name ?? "none"})</option>
                    {styles.map((style) => (
                      <option key={style.id} value={style.id}>
                        {style.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    {aiStatus?.available === false ? aiStatus.reason : "AI edits follow this style. Select text to see AI options."}
                  </p>
                </Field>

                <Field
                  label="URL"
                  htmlFor="doc-slug"
                  action={
                    slugLocked ? (
                      <button type="button" className="hover:text-foreground" onClick={() => setSlugUnlocked(true)}>
                        Change
                      </button>
                    ) : undefined
                  }
                >
                  <div className="relative">
                    <Input
                      id="doc-slug"
                      value={fields.slug}
                      readOnly={slugLocked}
                      onChange={(e) => change({ slug: e.target.value.toLowerCase().replace(/\s+/g, "-") })}
                      placeholder="post-url"
                      aria-describedby="doc-slug-help"
                      className={cn("h-9 rounded-lg bg-background font-mono text-xs", slugLocked && "pr-8 text-muted-foreground")}
                    />
                    {slugLocked && <Lock className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />}
                  </div>
                  <p id="doc-slug-help" className="break-all text-xs text-muted-foreground">
                    {slugLocked ? "Locked because the post is live. " : ""}narenc.com/thoughts/{fields.slug || "…"}
                  </p>
                </Field>

                <Field label="Date" htmlFor="doc-date">
                  <Input id="doc-date" type="date" value={fields.postDate} onChange={(e) => change({ postDate: e.target.value })} className="h-9 rounded-lg bg-background" />
                </Field>

                <Field label="Tags" htmlFor="doc-tags">
                  <Input
                    id="doc-tags"
                    value={tagDraft}
                    onChange={(e) => setTagDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                    onBlur={addTag}
                    placeholder="Add a tag, press Enter"
                    className="h-9 rounded-lg bg-background"
                  />
                  {fields.tags.length > 0 && (
                    <ul className="flex flex-wrap gap-1.5 pt-1" aria-label="Tags">
                      {fields.tags.map((tag) => (
                        <li key={tag}>
                          <span className="inline-flex items-center gap-1 rounded-full bg-background py-0.5 pl-2.5 pr-1 text-xs ring-1 ring-border">
                            {tag}
                            <button
                              type="button"
                              aria-label={`Remove tag ${tag}`}
                              className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                              onClick={() => change({ tags: fields.tags.filter((t) => t !== tag) })}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Field>

                <div className="space-y-1.5 border-t border-border/70 pt-5 text-xs text-muted-foreground">
                  <p className="flex items-center justify-between">Save a version <kbd className="kbd">⌘S</kbd></p>
                  <p className="flex items-center justify-between">Commands <kbd className="kbd">⌘K</kbd></p>
                  <p className="flex items-center justify-between">Focus mode <kbd className="kbd">⌘.</kbd></p>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </aside>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} commands={commands} />
      <VersionsSheet documentId={id} open={versionsOpen} onOpenChange={setVersionsOpen} onRestore={restoreVersion} />
      <PublishDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        title={fields.title}
        slug={fields.slug}
        excerpt={fields.excerpt}
        wordCount={wordCount}
        bodyJson={editor?.getJSON()}
        live={meta.live}
        onPublish={publish}
      />
    </div>
  );
}
