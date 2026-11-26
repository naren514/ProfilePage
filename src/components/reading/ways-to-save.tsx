"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bookmark, Check, Copy, KeyRound, Loader2, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatWhen } from "@/components/writing/client";
import { bookmarkletCode, readingFetch } from "./client";

interface TokenRow {
  id: string;
  name: string;
  lastUsedAt: string | null;
  createdAt: string;
  revokedAt: string | null;
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="h-8 shrink-0 rounded-full"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          toast.error("Couldn't copy. Select the text and copy it yourself.");
        }
      }}
    >
      {copied ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
      {copied ? "Copied" : label}
    </Button>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-2">
      <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[11px] font-medium tabular-nums">{n}</span>
      <div className="text-sm leading-relaxed">{children}</div>
    </li>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[12px]">{children}</code>;
}

export function WaysToSave() {
  const [origin, setOrigin] = useState("");
  const [tokens, setTokens] = useState<TokenRow[] | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const linkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => setOrigin(window.location.origin), []);

  // React won't render a javascript: href, so set it on the element directly
  useEffect(() => {
    if (linkRef.current && origin) linkRef.current.setAttribute("href", bookmarkletCode(origin));
  }, [origin]);

  const load = useCallback(async () => {
    try {
      const data = await readingFetch<{ tokens: TokenRow[] }>("/tokens");
      setTokens(data.tokens);
    } catch {
      setTokens([]);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    setBusy(true);
    try {
      const data = await readingFetch<{ token: string }>("/tokens", { method: "POST", json: { name: "iPhone Shortcut" } });
      setFresh(data.token);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't create a token");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id: string) => {
    if (!window.confirm("Revoke this token? Shortcuts that use it will stop working.")) return;
    try {
      await readingFetch(`/tokens/${id}`, { method: "DELETE" });
      toast.success("Token revoked");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't revoke the token");
    }
  };

  const active = (tokens ?? []).filter((t) => !t.revokedAt);
  const endpoint = `${origin}/api/reading/save?format=text`;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section aria-labelledby="ways-phone-app" className="rounded-2xl border border-foreground/20 p-6 lg:col-span-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-background">
            <Smartphone className="h-4 w-4" aria-hidden />
          </span>
          <h2 id="ways-phone-app" className="font-serif text-2xl">
            Phone: Save app on your home screen
          </h2>
          <span className="rounded-full bg-ai px-2 py-0.5 text-[11px] font-medium text-ai-foreground">Recommended</span>
        </div>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          No Shortcuts needed. Copy a link in any app (LinkedIn, X, Safari, Mail…), tap the <strong>Save</strong> icon on your home screen, then tap <strong>Paste &amp; save</strong>.
          On Android it also shows up in the share sheet.
        </p>
        <ol className="mt-5 grid gap-3 sm:grid-cols-3">
          <Step n={1}>
            On your phone, open <strong>{origin ? `${origin.replace(/^https?:\/\//, "")}/save` : "/save"}</strong> in Safari (Chrome on Android).
          </Step>
          <Step n={2}>
            Tap <strong>Share</strong> → <strong>Add to Home Screen</strong> → <strong>Add</strong>.
          </Step>
          <Step n={3}>
            Open <strong>Save</strong> from your home screen and tap <strong>Connect this phone</strong> (once; sign in if asked).
          </Step>
        </ol>
        {origin && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <CopyButton value={`${origin}/save`} label="Copy the link" />
            <a href="/save" target="_blank" rel="noreferrer" className="text-sm underline underline-offset-4">
              Open it here
            </a>
          </div>
        )}
      </section>

      <section aria-labelledby="ways-desktop" className="rounded-2xl border p-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
            <Bookmark className="h-4 w-4" aria-hidden />
          </span>
          <h2 id="ways-desktop" className="font-serif text-2xl">
            Desktop browser
          </h2>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          A one-click button for your bookmarks bar. It opens a small window with the article filled in and a suggested note; select a passage first to keep it as a
          quote.
        </p>
        <ol className="mt-5 space-y-3">
          <Step n={1}>Show your bookmarks bar (Chrome, Edge, Firefox: ⌘⇧B or Ctrl+Shift+B; Safari: View → Show Favorites Bar).</Step>
          <Step n={2}>
            Drag this button onto it:{" "}
            <a
              ref={linkRef}
              href="#"
              onClick={(e) => {
                e.preventDefault();
                toast.message("Drag the button to your bookmarks bar instead of clicking it here.");
              }}
              className="ml-1 inline-flex items-center gap-1.5 rounded-full bg-foreground px-3.5 py-1 text-sm font-medium text-background"
              aria-label="+ Reading (drag to your bookmarks bar)"
            >
              + Reading
            </a>
          </Step>
          <Step n={3}>On any article, click <strong>+ Reading</strong>, then choose <strong>Keep private</strong> or <strong>Publish now</strong>.</Step>
        </ol>
        {origin && (
          <details className="mt-5 text-sm">
            <summary className="cursor-pointer text-muted-foreground">Can&apos;t drag? Copy the code instead</summary>
            <p className="mt-2 text-muted-foreground">Create a new bookmark named “+ Reading” and paste this as its address:</p>
            <div className="mt-2 flex items-start gap-2">
              <code className="block max-h-24 flex-1 overflow-auto break-all rounded-lg bg-muted p-2 font-mono text-[11px]">{bookmarkletCode(origin)}</code>
              <CopyButton value={bookmarkletCode(origin)} label="Copy" />
            </div>
          </details>
        )}
      </section>

      <section aria-labelledby="ways-iphone" className="rounded-2xl border p-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
            <Smartphone className="h-4 w-4" aria-hidden />
          </span>
          <h2 id="ways-iphone" className="font-serif text-2xl">
            iPhone Shortcut (alternative)
          </h2>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          A <strong>Save to Reading</strong> Shortcut in the share sheet, for Safari, LinkedIn, X, Mail or any app that shares a link. Build it once in the Shortcuts app.
          Find each action with the <strong>search field at the bottom</strong> of the action list (“Search for apps and actions”).
        </p>

        <h3 className="mt-6 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">First, for either option</h3>
        <ol className="mt-3 space-y-3">
          <Step n={1}>
            Open <strong>Shortcuts</strong>, tap <strong>+</strong>, and name the shortcut <Code>Save to Reading</Code>.
          </Step>
          <Step n={2}>
            Tap <strong>ⓘ</strong> (Details) at the bottom and turn on <strong>Show in Share Sheet</strong>. A block “Receive <strong>Any</strong> input from Share Sheet”
            appears at the top; tap <strong>Any</strong> and keep only <strong>URLs</strong> and <strong>Safari web pages</strong>.
          </Step>
        </ol>

        <div className="mt-6 rounded-xl border border-ai/30 bg-ai-soft/60 p-4">
          <h3 className="flex flex-wrap items-center gap-2 text-sm font-medium">
            Option 1 · Opens the save window <span className="rounded-full bg-ai px-2 py-0.5 text-[11px] font-medium text-ai-foreground">Easiest</span>
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Two actions. Opens the same window as the desktop button: the article details, a suggested note, and Keep private / Publish now. Needs you logged in to
            the site in Safari (it asks you to log in when needed, then comes back).
          </p>
          <ol className="mt-4 space-y-3">
            <Step n={3}>
              Add <strong>Text</strong>. Paste this into it:
              <div className="mt-1.5 flex items-center gap-2">
                <code className="flex-1 break-all rounded-lg bg-background p-2 font-mono text-[12px]">{origin}/reading-save?url=</code>
                {origin && <CopyButton value={`${origin}/reading-save?url=`} label="Copy" />}
              </div>
              <span className="mt-1.5 block">
                Then, with the cursor right after <Code>url=</Code>, tap <strong>Shortcut Input</strong> in the bar above the keyboard to insert it.
              </span>
            </Step>
            <Step n={4}>
              Add <strong>Open URLs</strong>. It uses the Text automatically. Tap <strong>Done</strong>.
            </Step>
          </ol>
        </div>

        <div className="mt-4 rounded-xl bg-muted/50 p-4">
          <h3 className="text-sm font-medium">Option 2 · Saves in the background</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            You never leave the app and don&apos;t need to be logged in. It uses a personal token instead, and saves to your inbox; publish later from here.
          </p>

          <div className="mt-4 rounded-lg bg-background p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-sm font-medium">
                <KeyRound className="h-4 w-4" aria-hidden /> Your token
              </p>
              <Button type="button" size="sm" className="h-8 rounded-full" onClick={create} disabled={busy}>
                {busy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                {active.length ? "Create another token" : "Create token"}
              </Button>
            </div>
            {fresh && (
              <div className="mt-3 space-y-2" role="status">
                <p className="text-xs text-muted-foreground">Copy it now. For your security it won&apos;t be shown again.</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 break-all rounded-lg bg-muted p-2 font-mono text-[12px]" data-testid="new-token">
                    {fresh}
                  </code>
                  <CopyButton value={`Bearer ${fresh}`} label="Copy as header value" />
                </div>
              </div>
            )}
            {active.length > 0 && (
              <ul className="mt-3 divide-y text-sm" aria-label="Tokens">
                {active.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 py-2">
                    <span>
                      {t.name}
                      <span className="text-muted-foreground"> · created {formatWhen(t.createdAt)} · {t.lastUsedAt ? `last used ${formatWhen(t.lastUsedAt)}` : "never used"}</span>
                    </span>
                    <Button type="button" size="sm" variant="ghost" className="h-7 rounded-full text-xs" onClick={() => revoke(t.id)}>
                      Revoke
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <ol className="mt-4 space-y-3">
            <Step n={3}>
              Add <strong>Get Contents of URL</strong>. Tap its URL and paste:
              <div className="mt-1.5 flex items-center gap-2">
                <code className="flex-1 break-all rounded-lg bg-background p-2 font-mono text-[12px]">{endpoint}</code>
                {origin && <CopyButton value={endpoint} label="Copy" />}
              </div>
            </Step>
            <Step n={4}>
              Tap the <strong>›</strong> arrow on that action:
              <ul className="mt-1.5 list-disc space-y-1 pl-5 text-muted-foreground">
                <li>
                  <strong className="text-foreground">Method</strong>: POST
                </li>
                <li>
                  <strong className="text-foreground">Headers</strong> → Add new header: key <Code>Authorization</Code>, value: paste the token copied above (it starts with{" "}
                  <Code>Bearer rd_</Code>)
                </li>
                <li>
                  <strong className="text-foreground">Request Body</strong>: JSON → Add new field → Text: key <Code>url</Code>, value: <strong>Shortcut Input</strong>
                </li>
              </ul>
            </Step>
            <Step n={5}>
              Add <strong>Show Notification</strong> and set its text to <strong>Contents of URL</strong>. You&apos;ll see “Saved: <em>title</em> — in your Reading
              inbox.”
            </Step>
          </ol>
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer text-muted-foreground">Optional: choose Keep private or Publish now each time</summary>
            <ol className="mt-3 space-y-3">
              <Step n={6}>
                Add <strong>Choose from Menu</strong> <em>above</em> Get Contents of URL. Name its two options <Code>Keep private</Code> and <Code>Publish now</Code>.
              </Step>
              <Step n={7}>
                Under each option add a <strong>Text</strong> action containing the same words (<Code>Keep private</Code> or <Code>Publish now</Code>).
              </Step>
              <Step n={8}>
                In Get Contents of URL, add another JSON Text field: key <Code>publish</Code>, value: <strong>Menu Result</strong>. A note you&apos;d like published can go in a
                field <Code>note</Code> (use <strong>Ask for Input</strong> to type it).
              </Step>
            </ol>
          </details>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          The title, source, date and image are filled in automatically. An AI-suggested note waits in your inbox until you choose to use it; it&apos;s never published by
          itself.
        </p>
      </section>
    </div>
  );
}
