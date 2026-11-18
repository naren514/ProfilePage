"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import Placeholder from "@tiptap/extension-placeholder";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Cloud,
  CloudOff,
  Eye,
  History,
  Loader2,
  Lock,
  MoreHorizontal,
  Send,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
import { StatusBadge } from "./documents-list";
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

function SaveIndicator({ save }: { save: AutosaveSnapshot }) {
  const content = (() => {
    switch (save.state) {
      case "saving":
        return (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Saving…
          </>
        );
      case "dirty":
        return (
          <>
            <Cloud className="h-3.5 w-3.5" aria-hidden /> Unsaved changes
          </>
        );
      case "error":
        return (
          <span className="inline-flex items-center gap-1.5 text-destructive" title={save.message ?? undefined}>
            <CloudOff className="h-3.5 w-3.5" aria-hidden /> Not saved, retrying
          </span>
        );
      case "conflict":
        return (
          <span className="inline-flex items-center gap-1.5 text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> Not saved: edit conflict
          </span>
        );
      default:
        return (
          <>
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Saved
          </>
        );
    }
  })();
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" role="status" aria-live="polite">
      {content}
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

function Banner({ tone, children }: { tone: "warning" | "info"; children: React.ReactNode }) {
  return (
    <div
      role={tone === "warning" ? "alert" : "status"}
      className={
        tone === "warning"
          ? "flex flex-wrap items-center gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm"
          : "flex flex-wrap items-center gap-3 rounded-md border bg-muted/40 p-3 text-sm"
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
        class: "prose prose-neutral max-w-none min-h-[50vh] pb-24 focus:outline-none",
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

  return (
    <div className="mx-auto max-w-6xl">
      <header className="sticky top-0 z-20 -mx-8 -mt-8 mb-6 flex flex-wrap items-center justify-between gap-3 border-b bg-background/95 px-8 py-3 backdrop-blur">
        <div className="flex min-w-0 items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/stories">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Thoughts
            </Link>
          </Button>
          <StatusBadge status={meta.status} unpublishedChanges={hasUnpublishedChanges} />
          <SaveIndicator save={save} />
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-muted-foreground sm:inline" aria-live="off">
            {wordCount.toLocaleString()} words
          </span>
          <Button variant="ghost" size="sm" onClick={() => setVersionsOpen(true)}>
            <History className="mr-1.5 h-4 w-4" />
            Versions
          </Button>
          <Button variant="ghost" size="sm" onClick={openPreview}>
            <Eye className="mr-1.5 h-4 w-4" />
            Preview
          </Button>
          <Button size="sm" onClick={openPublish} disabled={save.state === "conflict"}>
            <Send className="mr-1.5 h-4 w-4" />
            {isLive ? (hasUnpublishedChanges ? "Update live post" : "Publish") : "Publish"}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="More actions" disabled={busy}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isLive && meta.live && (
                <DropdownMenuItem asChild>
                  <a href={`/thoughts/${meta.live.slug}`} target="_blank" rel="noreferrer">
                    View live post
                  </a>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={saveVersion}>
                Save version now
              </DropdownMenuItem>
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
        </div>
      </header>

      <div className="mb-6 space-y-3">
        {recovery && (
          <Banner tone="info">
            <span className="flex-1">
              This browser has changes to this post that weren&apos;t saved (from{" "}
              {new Date(recovery.savedAt).toLocaleString()}).
            </span>
            <Button size="sm" onClick={applyRecovery}>
              Recover them
            </Button>
            <Button
              size="sm"
              variant="ghost"
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
              This post was saved somewhere else (another tab or device) after you opened it, so your latest changes
              haven&apos;t been saved.
            </span>
            <Button size="sm" onClick={conflictKeepMine}>
              Keep my version
            </Button>
            <Button size="sm" variant="outline" onClick={conflictTakeTheirs}>
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
              The live post was edited outside the Studio (in the classic editor). Publishing from here would replace
              those edits.
            </span>
            <Button size="sm" variant="outline" onClick={pullLive}>
              Use the live version
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setMeta((m) => ({ ...m, liveChangedOutside: false }))}>
              Keep my draft
            </Button>
          </Banner>
        )}
      </div>

      <div className={ai.suggestion ? "grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]" : "grid gap-10 lg:grid-cols-[minmax(0,1fr)_15rem]"}>
        <div className="min-w-0">
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
            className="w-full resize-none overflow-hidden bg-transparent text-4xl font-bold leading-tight tracking-tight placeholder:text-muted-foreground/50 focus:outline-none"
          />
          <label htmlFor="doc-excerpt" className="sr-only">
            Excerpt
          </label>
          <AutoGrowTextarea
            id="doc-excerpt"
            value={fields.excerpt}
            onChange={(e) => change({ excerpt: e.target.value.replace(/\n/g, " ") })}
            placeholder="Excerpt: one or two sentences shown on the Thoughts page"
            rows={1}
            maxLength={1000}
            className="mt-3 w-full resize-none overflow-hidden bg-transparent text-lg text-muted-foreground placeholder:text-muted-foreground/50 focus:outline-none"
          />

          <div className="sticky top-[57px] z-10 -mx-2 mt-6 border-y bg-background/95 px-2 py-1 backdrop-blur">
            {editor && <EditorToolbar editor={editor} onUploadImage={uploadImage} uploading={uploading} />}
          </div>
          <div className="mt-6">
            <EditorContent editor={editor} />
            {editor && aiStatus?.available && (
              <AiBubbleMenu editor={editor} styles={styles} disabled={Boolean(ai.suggestion)} onRun={ai.run} />
            )}
          </div>
        </div>

        <aside className="space-y-6 text-sm lg:sticky lg:top-[72px] lg:max-h-[calc(100vh-5rem)] lg:self-start lg:overflow-y-auto" aria-label="Post details">
          {ai.suggestion && (
            <SuggestionPanel
              suggestion={ai.suggestion}
              onAccept={ai.accept}
              onReject={() => ai.dismiss("rejected")}
              onRetry={ai.retry}
            />
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="doc-style">Writing style</Label>
              <Link href="/admin/stories/styles" className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
                Edit styles
              </Link>
            </div>
            <select
              id="doc-style"
              value={fields.styleId}
              onChange={(e) => change({ styleId: e.target.value })}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Default ({styles.find((s) => s.isDefault)?.name ?? "none"})</option>
              {styles.map((style) => (
                <option key={style.id} value={style.id}>
                  {style.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              {aiStatus?.available === false
                ? aiStatus.reason
                : "AI edits follow this style. Select text to see AI options."}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="doc-slug">URL</Label>
              {slugLocked && (
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                  onClick={() => setSlugUnlocked(true)}
                >
                  Change
                </button>
              )}
            </div>
            <div className="relative">
              <Input
                id="doc-slug"
                value={fields.slug}
                readOnly={slugLocked}
                onChange={(e) => change({ slug: e.target.value.toLowerCase().replace(/\s+/g, "-") })}
                placeholder="post-url"
                aria-describedby="doc-slug-help"
                className={slugLocked ? "pr-8 text-muted-foreground" : undefined}
              />
              {slugLocked && <Lock className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />}
            </div>
            <p id="doc-slug-help" className="break-all text-xs text-muted-foreground">
              {slugLocked ? "Locked because the post is live. " : ""}/thoughts/{fields.slug || "…"}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="doc-date">Date</Label>
            <Input id="doc-date" type="date" value={fields.postDate} onChange={(e) => change({ postDate: e.target.value })} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="doc-tags">Tags</Label>
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
            />
            {fields.tags.length > 0 && (
              <ul className="flex flex-wrap gap-1.5" aria-label="Tags">
                {fields.tags.map((tag) => (
                  <li key={tag}>
                    <Badge variant="secondary" className="gap-1 pr-1">
                      {tag}
                      <button
                        type="button"
                        aria-label={`Remove tag ${tag}`}
                        className="rounded-sm p-0.5 hover:bg-background/60"
                        onClick={() => change({ tags: fields.tags.filter((t) => t !== tag) })}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Changes save automatically. Press <kbd className="rounded border px-1">Ctrl</kbd>+
            <kbd className="rounded border px-1">S</kbd> to save a version you can return to.
          </p>
        </aside>
      </div>

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
