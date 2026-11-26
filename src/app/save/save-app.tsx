"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ClipboardPaste, Loader2, Lock, Globe, Share, SquarePlus, X } from "lucide-react";
import { cn } from "@/lib/utils";

// "Save to Reading" as a home-screen app: copy a link anywhere, open the app,
// tap Paste & save. It keeps its own long-lived token (a personal reading
// token, revocable in Admin → Reading → Ways to save), so it keeps working
// after the admin login expires. On Android it also appears in the share sheet.

const TOKEN_KEY = "reading-save:token";
const RECENT_KEY = "reading-save:recent";

interface Recent {
  title: string;
  status: string;
  at: number;
}

const store = {
  get(key: string) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // private mode
    }
  },
  remove(key: string) {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
};

const firstUrl = (s: string) => s.match(/https?:\/\/[^\s<>"']+/i)?.[0]?.replace(/[).,;!?]+$/, "") ?? "";

type Result = { ok: true; title: string; message: string; published: boolean } | { ok: false; message: string };

export function SaveApp({ shared }: { shared: { url: string; text: string; title: string } }) {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [link, setLink] = useState("");
  const [publish, setPublish] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [recent, setRecent] = useState<Recent[]>([]);
  const [standalone, setStandalone] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const autoSaved = useRef(false);

  useEffect(() => {
    setToken(store.get(TOKEN_KEY));
    try {
      setRecent(JSON.parse(store.get(RECENT_KEY) ?? "[]"));
    } catch {
      setRecent([]);
    }
    const nav = navigator as Navigator & { standalone?: boolean };
    setStandalone(Boolean(nav.standalone) || window.matchMedia("(display-mode: standalone)").matches);
  }, []);

  const save = useCallback(
    async (value: string) => {
      const url = firstUrl(value);
      if (!url) {
        setResult({ ok: false, message: "That doesn't look like a link. Copy the article's address and try again." });
        return;
      }
      if (!token) return;
      setBusy(true);
      setResult(null);
      try {
        const res = await fetch("/api/reading/save", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ url, title: shared.title || undefined, publish }),
        });
        const body = await res.json().catch(() => ({}));
        if (res.status === 401) {
          store.remove(TOKEN_KEY);
          setToken(null);
          setResult({ ok: false, message: "This phone was disconnected. Connect it again below." });
          return;
        }
        if (!res.ok) throw new Error(body.error ?? "Couldn't save the article.");
        const item: Recent = { title: body.title ?? url, status: body.status ?? "inbox", at: Date.now() };
        const next = [item, ...recent.filter((r) => r.title !== item.title)].slice(0, 5);
        setRecent(next);
        store.set(RECENT_KEY, JSON.stringify(next));
        setResult({ ok: true, title: item.title, message: body.message ?? "Saved.", published: body.status === "published" });
        setLink("");
        navigator.vibrate?.(15);
      } catch (e) {
        setResult({ ok: false, message: e instanceof Error ? e.message : "Couldn't save the article." });
      } finally {
        setBusy(false);
      }
    },
    [token, publish, recent, shared.title]
  );

  // Shared into the app (Android share sheet, or a link opened with ?url=): save straight away
  useEffect(() => {
    if (autoSaved.current || !token) return;
    const incoming = firstUrl(`${shared.url} ${shared.text}`);
    if (!incoming) return;
    autoSaved.current = true;
    void save(incoming);
    window.history.replaceState(null, "", "/save");
  }, [token, shared, save]);

  const pasteAndSave = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!firstUrl(text)) {
        setLink(text);
        setResult({ ok: false, message: "The clipboard doesn't hold a link. Copy the article's address first, or paste it below." });
        return;
      }
      setLink(firstUrl(text));
      await save(text);
    } catch {
      setResult({ ok: false, message: "Your phone didn't share the clipboard. Paste the link in the box below instead." });
    }
  };

  const connect = async () => {
    setConnecting(true);
    setNeedsLogin(false);
    setConnectError(null);
    try {
      const res = await fetch("/api/admin/reading/tokens", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Home screen app" }) });
      if (res.status === 401 || res.status === 403 || res.redirected) {
        setNeedsLogin(true);
        return;
      }
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.token) throw new Error(body.error ?? "Couldn't connect.");
      store.set(TOKEN_KEY, body.token);
      setToken(body.token);
    } catch (e) {
      setConnectError(e instanceof Error ? e.message : "Couldn't connect. Check your connection and try again.");
    } finally {
      setConnecting(false);
    }
  };

  if (token === undefined) return <div className="min-h-[100dvh] bg-background" />;

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col gap-6 bg-background px-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-[calc(env(safe-area-inset-top)+1.5rem)]">
      <header className="space-y-1">
        <h1 className="font-serif text-[2rem] leading-tight tracking-tight">Save to Reading</h1>
        <p className="text-[0.9375rem] text-muted-foreground">Copy a link in any app, then come back here.</p>
      </header>

      {!token ? (
        <section className="space-y-4 rounded-3xl border p-5" aria-label="Connect this phone">
          {result && !result.ok && (
            <p role="status" className="rounded-2xl bg-amber-500/10 p-3 text-sm text-amber-900">
              {result.message}
            </p>
          )}
          <p className="font-medium">Connect this phone (once)</p>
          <p className="text-sm text-muted-foreground">This lets the app save to your reading list without signing in each time. You can disconnect it any time in Admin → Reading → Ways to save.</p>
          {connectError && (
            <p role="alert" className="rounded-2xl bg-amber-500/10 p-3 text-sm text-amber-900">
              {connectError}
            </p>
          )}
          {needsLogin ? (
            <a href="/login?next=/save" className="flex h-14 items-center justify-center rounded-2xl bg-foreground text-base font-medium text-background">
              Sign in to connect
            </a>
          ) : (
            <button type="button" onClick={connect} disabled={connecting} className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-foreground text-base font-medium text-background disabled:opacity-60">
              {connecting && <Loader2 className="h-5 w-5 animate-spin" />}
              Connect this phone
            </button>
          )}
        </section>
      ) : (
        <>
          <button
            type="button"
            onClick={pasteAndSave}
            disabled={busy}
            className="flex min-h-[9rem] w-full flex-col items-center justify-center gap-2 rounded-3xl bg-foreground px-6 text-background shadow-lg shadow-foreground/10 transition-transform active:scale-[0.98] disabled:opacity-70 motion-reduce:transition-none"
          >
            {busy ? <Loader2 className="h-8 w-8 animate-spin" /> : <ClipboardPaste className="h-8 w-8" strokeWidth={1.5} />}
            <span className="text-lg font-medium">{busy ? "Saving…" : "Paste & save"}</span>
            <span className="text-sm opacity-70">Saves the link you copied</span>
          </button>

          <div role="radiogroup" aria-label="After saving" className="grid grid-cols-2 gap-2 rounded-2xl bg-muted p-1">
            {(
              [
                [false, "Keep private", Lock],
                [true, "Publish now", Globe],
              ] as const
            ).map(([value, label, Icon]) => (
              <button key={label} type="button" role="radio" aria-checked={publish === value} onClick={() => setPublish(value)} className={cn("flex h-11 items-center justify-center gap-2 rounded-xl text-sm transition-colors", publish === value ? "bg-background font-medium shadow-sm" : "text-muted-foreground")}>
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>

          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void save(link);
            }}
          >
            <input type="url" inputMode="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="Or paste a link here" aria-label="Article link" className="h-12 min-w-0 flex-1 rounded-2xl border bg-background px-4 text-base outline-none focus:ring-2 focus:ring-ring" />
            <button type="submit" disabled={busy || !link.trim()} className="h-12 shrink-0 rounded-2xl border px-4 text-sm font-medium disabled:opacity-50">
              Save
            </button>
          </form>

          {result && (
            <div role="status" className={cn("flex items-start gap-3 rounded-2xl p-4 text-sm", result.ok ? "bg-emerald-500/10 text-emerald-900" : "bg-amber-500/10 text-amber-900")}>
              {result.ok ? <Check className="mt-0.5 h-4 w-4 shrink-0" /> : <X className="mt-0.5 h-4 w-4 shrink-0" />}
              <span>{result.message}</span>
            </div>
          )}

          {recent.length > 0 && (
            <section aria-label="Saved recently" className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Saved recently</p>
              <ul className="divide-y rounded-2xl border">
                {recent.map((r) => (
                  <li key={r.at} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <span className="truncate">{r.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{r.status === "published" ? "Published" : "Inbox"}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {!standalone && (
        <aside className="mt-auto space-y-2 rounded-2xl bg-muted/60 p-4 text-sm" aria-label="Add to Home Screen">
          <p className="font-medium">Put this on your home screen</p>
          <ol className="space-y-1.5 text-muted-foreground">
            <li className="flex items-center gap-2">
              1. In Safari, tap <Share className="inline h-4 w-4" aria-label="Share" /> Share
            </li>
            <li className="flex items-center gap-2">
              2. Tap <SquarePlus className="inline h-4 w-4" aria-hidden /> Add to Home Screen, then Add
            </li>
            <li>3. Open “Save” from your home screen and connect it once</li>
          </ol>
        </aside>
      )}
    </div>
  );
}
