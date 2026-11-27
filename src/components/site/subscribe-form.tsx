"use client";

import { useState } from "react";
import { Loader2, Mail } from "lucide-react";

// Get the weekly reading list by email. Double opt-in: the server sends a
// confirmation link, and says the same thing whether or not you were
// already subscribed.

export function SubscribeForm({ compact = false }: { compact?: boolean }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setState("sending");
    try {
      const website = String(new FormData(e.currentTarget).get("website") ?? "");
      const res = await fetch("/api/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, website }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Couldn't sign you up just now.");
      setMessage(body.message ?? "Check your inbox to confirm.");
      setState("done");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Couldn't sign you up just now.");
      setState("error");
    }
  };

  return (
    <section aria-label="Get it by email" className={compact ? "space-y-3" : "space-y-3 rounded-2xl border px-5 py-5 sm:px-6"}>
      <div className="space-y-1">
        <h2 className="flex items-center gap-2 font-serif text-xl">
          <Mail className="h-4 w-4 text-muted-foreground" aria-hidden /> Get it by email
        </h2>
        <p className="text-sm text-muted-foreground">One email a week with the list. No other mail, and you can unsubscribe in one click.</p>
      </div>
      {state === "done" ? (
        <p role="status" className="text-sm font-medium">
          {message}
        </p>
      ) : (
        <form onSubmit={submit} className="flex flex-wrap gap-2">
          <label htmlFor="subscribe-email" className="sr-only">
            Your email address
          </label>
          <input
            id="subscribe-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="h-11 min-w-[14rem] flex-1 rounded-full border bg-background px-4 text-[0.9375rem] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {/* Left empty by people; bots fill it in */}
          <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
          <button type="submit" disabled={state === "sending"} className="inline-flex h-11 items-center gap-2 rounded-full bg-foreground px-5 text-sm font-medium text-background disabled:opacity-60">
            {state === "sending" && <Loader2 className="h-4 w-4 animate-spin" />}
            Subscribe
          </button>
          {state === "error" && (
            <p role="alert" className="w-full text-sm text-red-700">
              {message}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
