import { Metadata } from "next";
import Link from "next/link";
import { and, count, desc, eq, gte, isNotNull, isNull, ne, sql } from "drizzle-orm";
import { AlertTriangle, ArrowRight, ArrowUpRight, Bot, Feather, Inbox, ListChecks } from "lucide-react";
import { db } from "@/lib/db";
import { apiTokens, certifications, experiences, projects, readingCandidates, readingFeedItems, readingSources, readingWeeklyLists, writingAgentRuns, writingDocuments, writingIdeas, writingTriggers } from "@/lib/db/schema";
import { SCHEMA_READY_SQL } from "@/lib/writing/setup-sql";
import { READING_READY_SQL } from "@/lib/reading/setup-sql";
import { AGENT_READY_SQL } from "@/lib/agent/setup-sql";
import { GettingStarted, type Step } from "@/components/admin/getting-started";
import { WORKFLOWS, type WorkflowId } from "@/lib/agent/workflows";
import { getServerUser } from "@/lib/auth/server-auth";
import { formatRelative } from "@/lib/format-relative";

export const metadata: Metadata = { title: "Home | Admin" };
export const dynamic = "force-dynamic";

// Home ("Today"): what needs the author now, what they were doing, and the
// site at a glance. Each query is independent: a missing table (before
// "Set up now") hides its section instead of breaking the page.

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

async function load() {
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const [waiting, failed, inbox, inboxCount, drafts, ideas, shortlist, feedNew, counts] = await Promise.all([
    safe(() => db.select({ id: writingAgentRuns.id, workflow: writingAgentRuns.workflow, documentId: writingAgentRuns.documentId, pending: writingAgentRuns.pendingApproval, updatedAt: writingAgentRuns.updatedAt }).from(writingAgentRuns).where(eq(writingAgentRuns.status, "WAITING_FOR_APPROVAL")).orderBy(desc(writingAgentRuns.updatedAt)).limit(5), []),
    safe(async () => (await db.select({ n: count() }).from(writingAgentRuns).where(and(eq(writingAgentRuns.status, "FAILED"), gte(writingAgentRuns.updatedAt, weekAgo))))[0]?.n ?? 0, 0),
    safe(() => db.select({ id: certifications.id, title: certifications.articleTitle, source: certifications.source, savedAt: certifications.savedAt }).from(certifications).where(eq(certifications.status, "inbox")).orderBy(desc(certifications.savedAt)).limit(3), []),
    safe(async () => (await db.select({ n: count() }).from(certifications).where(eq(certifications.status, "inbox")))[0]?.n ?? 0, 0),
    safe(() => db.select({ id: writingDocuments.id, title: writingDocuments.title, words: writingDocuments.wordCount, updatedAt: writingDocuments.updatedAt }).from(writingDocuments).where(and(ne(writingDocuments.status, "PUBLISHED"), ne(writingDocuments.status, "ARCHIVED"))).orderBy(desc(writingDocuments.updatedAt)).limit(4), []),
    safe(async () => (await db.select({ n: count() }).from(writingIdeas).where(eq(writingIdeas.status, "new")))[0]?.n ?? 0, 0),
    safe(async () => (await db.select({ n: count() }).from(readingCandidates).where(eq(readingCandidates.status, "active")))[0]?.n ?? 0, 0),
    safe(async () => (await db.select({ n: count() }).from(readingFeedItems).where(and(eq(readingFeedItems.status, "new"), gte(readingFeedItems.createdAt, weekAgo))))[0]?.n ?? 0, 0),
    safe(
      async () => {
        const [p, e, posts, reads] = await Promise.all([
          db.select({ n: count() }).from(projects),
          db.select({ n: count() }).from(experiences),
          db.select({ n: count() }).from(writingDocuments).where(eq(writingDocuments.status, "PUBLISHED")),
          db.select({ n: count() }).from(certifications).where(eq(certifications.status, "published")),
        ]);
        return { projects: p[0]?.n ?? 0, experience: e[0]?.n ?? 0, posts: posts[0]?.n ?? 0, reading: reads[0]?.n ?? 0 };
      },
      { projects: 0, experience: 0, posts: 0, reading: 0 }
    ),
  ]);
  return { waiting, failed, inbox, inboxCount, drafts, ideas, shortlist, feedNew, counts, steps: await gettingStarted(counts.posts) };
}

const n = async (q: Promise<Array<{ n: number }>>) => (await q)[0]?.n ?? 0;

/** The getting-started checklist: each step is done when its result exists. */
async function gettingStarted(posts: number): Promise<Step[]> {
  const ready = await safe(async () => {
    for (const q of [SCHEMA_READY_SQL, READING_READY_SQL, AGENT_READY_SQL]) {
      const r = await db.execute(sql.raw(q));
      if (!(r.rows[0] as { ready?: boolean } | undefined)?.ready) return false;
    }
    return true;
  }, false);
  const [sources, phone, nightly, lists] = await Promise.all([
    safe(() => n(db.select({ n: count() }).from(readingSources).where(isNotNull(readingSources.lastCheckedAt))), 0),
    safe(() => n(db.select({ n: count() }).from(apiTokens).where(isNull(apiTokens.revokedAt))), 0),
    safe(() => n(db.select({ n: count() }).from(writingTriggers).where(and(eq(writingTriggers.key, "reading-scout-nightly"), eq(writingTriggers.enabled, true)))), 0),
    safe(() => n(db.select({ n: count() }).from(readingWeeklyLists)), 0),
  ]);
  return [
    { id: "setup", label: "Finish setting up the Studio", href: "/admin/stories", done: ready },
    { id: "sources", label: "Pick your reading sources", href: "/admin/reading/settings#sources", done: sources > 0 },
    { id: "phone", label: "Put Save on your phone", href: "/admin/reading/settings#ways-to-save", done: phone > 0 },
    { id: "nightly", label: "Turn on the nightly reading search", href: "/admin/reading/settings#schedule", done: nightly > 0 },
    { id: "post", label: "Publish your first post", href: "/admin/stories", done: posts > 0 },
    { id: "weekly", label: "Approve your first weekly list", href: "/admin/reading/week", done: lists > 0 },
  ];
}

function greeting(now: Date) {
  const hour = Number(now.toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "America/Los_Angeles" }));
  return hour < 5 ? "Working late" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

function Section({ title, action, children }: { title: string; action?: { href: string; label: string }; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-muted-foreground">{title}</h2>
        {action && (
          <Link href={action.href} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            {action.label} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function Row({ href, icon: Icon, title, meta, tone }: { href: string; icon: typeof Inbox; title: string; meta?: string; tone?: "attention" }) {
  return (
    <li>
      <Link href={href} className="group flex min-h-[56px] items-center gap-3.5 px-4 py-3 outline-none transition-colors hover:bg-muted/50 focus-visible:bg-muted/60">
        <span className={tone === "attention" ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-700" : "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"}>
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.9375rem]">{title}</span>
          {meta && <span className="block truncate text-xs text-muted-foreground">{meta}</span>}
        </span>
        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
      </Link>
    </li>
  );
}

export default async function AdminHome() {
  const [user, data] = await Promise.all([getServerUser(), load()]);
  const now = new Date();
  const first = (user?.name || "").split(" ")[0];
  const needs = data.waiting.length + (data.failed ? 1 : 0) + (data.inboxCount ? 1 : 0);

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">{now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "America/Los_Angeles" })}</p>
        <h1 className="font-serif text-[2.25rem] font-medium leading-tight tracking-tight sm:text-[2.75rem]">
          {greeting(now)}
          {first ? `, ${first}` : ""}.
        </h1>
        <p className="text-[0.9375rem] text-muted-foreground">{needs === 0 ? "Nothing is waiting for you. A good day to write." : `${needs} thing${needs === 1 ? "" : "s"} could use your attention.`}</p>
      </header>

      <GettingStarted steps={data.steps} />

      {needs > 0 && (
        <Section title="Needs you">
          <ul className="divide-y overflow-hidden rounded-2xl border">
            {data.waiting.map((r) => {
              const wf = WORKFLOWS[r.workflow as WorkflowId];
              return <Row key={r.id} href={r.workflow === "reading_weekly" ? "/admin/reading/week" : r.documentId ? `/admin/stories/${r.documentId}?run=${r.id}` : `/admin/stories/runs/${r.id}`} icon={r.workflow.startsWith("reading") ? ListChecks : Bot} title={r.pending?.title ?? `${wf?.label ?? r.workflow} is waiting`} meta={`${wf?.label ?? r.workflow} · waiting ${formatRelative(r.updatedAt)}`} />;
            })}
            {data.inboxCount > 0 && <Row href="/admin/reading/inbox" icon={Inbox} title={`${data.inboxCount} article${data.inboxCount === 1 ? "" : "s"} in your reading inbox`} meta={data.inbox.map((i) => i.title).join(" · ")} />}
            {data.failed > 0 && <Row href="/admin/ai/history" icon={AlertTriangle} tone="attention" title={`${data.failed} run${data.failed === 1 ? "" : "s"} failed this week`} meta="See what happened in AI → History" />}
          </ul>
        </Section>
      )}

      <Section title="Continue writing" action={{ href: "/admin/stories", label: "All thoughts" }}>
        {data.drafts.length === 0 ? (
          <p className="rounded-2xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">No drafts in progress. Press Capture or start a new thought.</p>
        ) : (
          <ul className="divide-y overflow-hidden rounded-2xl border">
            {data.drafts.map((d) => (
              <Row key={d.id} href={`/admin/stories/${d.id}`} icon={Feather} title={d.title || "Untitled"} meta={`${d.words} words · edited ${formatRelative(d.updatedAt)}`} />
            ))}
          </ul>
        )}
        {data.ideas > 0 && (
          <p className="text-sm text-muted-foreground">
            <Link href="/admin/stories" className="underline underline-offset-4 hover:text-foreground">
              {data.ideas} idea{data.ideas === 1 ? "" : "s"}
            </Link>{" "}
            waiting in your inbox.
          </p>
        )}
      </Section>

      <Section title="Reading" action={{ href: "/admin/reading/week", label: "This week" }}>
        <div className="grid gap-3 sm:grid-cols-3">
          <Link href="/admin/reading" className="rounded-2xl border p-4 transition-colors hover:bg-muted/40">
            <p className="font-serif text-3xl tabular-nums">{data.feedNew}</p>
            <p className="text-sm text-muted-foreground">new from your sources this week</p>
          </Link>
          <Link href="/admin/reading/inbox" className="rounded-2xl border p-4 transition-colors hover:bg-muted/40">
            <p className="font-serif text-3xl tabular-nums">{data.inboxCount}</p>
            <p className="text-sm text-muted-foreground">in your inbox to note or publish</p>
          </Link>
          <Link href="/admin/reading/week" className="rounded-2xl border p-4 transition-colors hover:bg-muted/40">
            <p className="font-serif text-3xl tabular-nums">{data.shortlist}</p>
            <p className="text-sm text-muted-foreground">found by the agent for this week&apos;s list</p>
          </Link>
        </div>
      </Section>

      <Section title="Your site">
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-4">
          {(
            [
              ["Posts", data.counts.posts, "/admin/stories"],
              ["Reading", data.counts.reading, "/admin/reading/published"],
              ["Work", data.counts.projects, "/admin/projects"],
              ["Experience", data.counts.experience, "/admin/experience"],
            ] as const
          ).map(([label, n, href]) => (
            <Link key={label} href={href} className="bg-background p-4 transition-colors hover:bg-muted/40">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="font-serif text-2xl tabular-nums">{n}</dd>
            </Link>
          ))}
        </dl>
        <a href="/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          View the public site <ArrowUpRight className="h-3.5 w-3.5" />
        </a>
      </Section>
    </div>
  );
}
