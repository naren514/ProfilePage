import { Metadata } from "next";
import Link from "next/link";
import { Container, EmptyState, PageHeader } from "@/components/site/ui";
import { weeklyLists, weekLabel } from "@/lib/reading/shortlist";
import { emailConfigured } from "@/lib/email/send";
import { SubscribeForm } from "@/components/site/subscribe-form";
import type { ReadingWeeklyList } from "@/lib/db/schema";

export const metadata: Metadata = {
  title: "Weekly reading lists",
  description: "Each week, a few articles worth your time, with a line on why.",
  alternates: { types: { "application/rss+xml": [{ url: "/reading/weekly/rss.xml", title: "Worth your time (weekly)" }] } },
};

export const dynamic = "force-dynamic";

async function lists(): Promise<ReadingWeeklyList[]> {
  try {
    return await weeklyLists(104);
  } catch {
    return []; // before the database update has run
  }
}

export default async function WeeklyIndexPage(props: { searchParams: Promise<{ subscribed?: string }> }) {
  const { subscribed } = await props.searchParams;
  const rows = await lists();
  return (
    <Container size="narrow">
      <PageHeader eyebrow={<Link href="/certifications">Reading list</Link>} title="Weekly lists" description="Each week, a handful of articles worth your time, with a line on why." />
      {subscribed && (
        <p role="status" className="mb-8 rounded-2xl border px-5 py-4 text-[0.9375rem]">
          {subscribed === "1" ? "You're subscribed. The next list will arrive in your inbox." : "That confirmation link didn't work. It may be old: sign up again below."}
        </p>
      )}
      <div className="mb-10 space-y-4">
        {emailConfigured() && subscribed !== "1" && <SubscribeForm />}
        <p className="text-sm text-muted-foreground">
          Or follow with a feed reader:{" "}
          <a href="/reading/weekly/rss.xml" className="underline underline-offset-4">
            RSS
          </a>
        </p>
      </div>
      {rows.length === 0 ? (
        <EmptyState>The first weekly list is on its way.</EmptyState>
      ) : (
        <ol className="border-t">
          {rows.map((l) => (
            <li key={l.id} className="border-b py-6">
              <Link href={`/reading/weekly/${l.week}`} className="group block">
                <p className="text-sm text-muted-foreground">{weekLabel(l.week)}</p>
                <p className="mt-1 font-serif text-2xl leading-snug group-hover:underline group-hover:underline-offset-[6px]">{l.title || `${l.picks.length} pieces worth your time`}</p>
                {l.intro && <p className="mt-2 line-clamp-2 max-w-2xl text-muted-foreground">{l.intro}</p>}
              </Link>
            </li>
          ))}
        </ol>
      )}
    </Container>
  );
}
