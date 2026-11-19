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
  const endpoint = `${origin}/api/reading/save`;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
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
            iPhone and iPad
          </h2>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          A Shortcut in the share sheet. Share any link from Safari, LinkedIn, X, Mail or a newsletter app, pick <strong>Save to Reading</strong>, and you never leave the
          app. It works even when you&apos;re logged out of the site.
        </p>

        <div className="mt-5 rounded-xl bg-muted/50 p-4">
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
                <code className="flex-1 break-all rounded-lg bg-background p-2 font-mono text-[12px]" data-testid="new-token">
                  {fresh}
                </code>
                <CopyButton value={fresh} label="Copy" />
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

        <h3 className="mt-6 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Build the Shortcut (about 3 minutes, once)</h3>
        <ol className="mt-3 space-y-3">
          <Step n={1}>
            Open <strong>Shortcuts</strong> → <strong>+</strong>. Name it <Code>Save to Reading</Code>. Tap the <strong>ⓘ</strong> button and turn on{" "}
            <strong>Show in Share Sheet</strong>; set it to receive <strong>URLs</strong> and <strong>Safari web pages</strong>.
          </Step>
          <Step n={2}>
            Add <strong>List</strong> with two items, <Code>Keep private</Code> and <Code>Publish now</Code>, then <strong>Choose from List</strong> with the prompt{" "}
            <Code>Save how?</Code>.
          </Step>
          <Step n={3}>
            Add <strong>Ask for Input</strong> (Text) with the prompt <Code>Your note (optional)</Code>.
          </Step>
          <Step n={4}>
            Add <strong>Get Contents of URL</strong>:
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-muted-foreground">
              <li>
                URL: <Code>{endpoint || "https://your-site/api/reading/save"}</Code> {origin && <CopyButton value={endpoint} label="Copy URL" />}
              </li>
              <li>
                Method <Code>POST</Code>; Headers: <Code>Authorization</Code> = <Code>Bearer</Code> + a space + your token
              </li>
              <li>
                Request Body <strong>JSON</strong>: <Code>url</Code> = Shortcut Input, <Code>publish</Code> = Chosen Item, <Code>note</Code> = Provided Input
              </li>
            </ul>
          </Step>
          <Step n={5}>
            Add <strong>Get Dictionary Value</strong> for key <Code>message</Code>, then <strong>Show Notification</strong> with it. Done: share a link and pick{" "}
            <strong>Save to Reading</strong>.
          </Step>
        </ol>
        <p className="mt-4 text-xs text-muted-foreground">
          The title, source, date and image are filled in automatically. Notes you type in the Shortcut are published as-is; an AI-suggested note waits in the inbox
          until you choose to use it.
        </p>
      </section>
    </div>
  );
}
