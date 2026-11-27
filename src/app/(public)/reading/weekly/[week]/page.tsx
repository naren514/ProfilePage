import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { Container, PageHeader } from "@/components/site/ui";
import { TopicLinks } from "@/components/site/topics";
import { weeklyList, weekLabel } from "@/lib/reading/shortlist";
import { SITE_NAME, siteUrl } from "@/lib/site";
import { emailConfigured } from "@/lib/email/send";
import { SubscribeForm } from "@/components/site/subscribe-form";

export const dynamic = "force-dynamic";

async function load(week: string) {
  if (!/^\d{4}-W\d{2}$/.test(week)) return null;
  try {
    return await weeklyList(week);
  } catch {
    return null;
  }
}

export async function generateMetadata(props: { params: Promise<{ week: string }> }): Promise<Metadata> {
  const params = await props.params;
  const list = await load(params.week);
  if (!list) return { title: "Weekly reading list" };
  const title = list.title || `Worth your time: ${weekLabel(list.week)}`;
  const url = siteUrl(`/reading/weekly/${list.week}`);
  return {
    title,
    description: list.intro.slice(0, 160),
    alternates: { canonical: url, types: { "application/rss+xml": [{ url: "/reading/weekly/rss.xml", title: "Worth your time (weekly)" }] } },
    openGraph: { type: "article", url, title, description: list.intro.slice(0, 200), siteName: SITE_NAME },
    twitter: { card: "summary_large_image", title, description: list.intro.slice(0, 200) },
  };
}

export default async function WeeklyListPage(props: { params: Promise<{ week: string }> }) {
  const params = await props.params;
  const list = await load(params.week);
  if (!list) notFound();
  return (
    <Container size="narrow">
      <PageHeader eyebrow={<Link href="/reading/weekly">Weekly list · {weekLabel(list.week)}</Link>} title={list.title || "Worth your time this week"} description={list.intro} />
      <ol className="border-t">
        {list.picks.map((p, i) => (
          <li key={`${p.url}-${i}`} className="grid gap-x-10 gap-y-2 border-b py-8 sm:grid-cols-[3rem_minmax(0,1fr)]">
            <span className="pt-1 font-serif text-2xl tabular-nums text-muted-foreground">{i + 1}</span>
            <div className="min-w-0">
              <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{p.publisher}</p>
              <Link href={p.url} target="_blank" rel="noopener noreferrer" className="group inline underline-offset-[6px] decoration-1 hover:underline">
                <span className="text-balance font-serif text-2xl leading-snug tracking-[-0.01em]">{p.title}</span>
                <ArrowUpRight className="ml-1 inline h-4 w-4 -translate-y-0.5 text-muted-foreground" aria-hidden />
                <span className="sr-only">(opens {p.publisher} in a new tab)</span>
              </Link>
              <p className="mt-3 max-w-2xl text-pretty leading-relaxed text-muted-foreground">{p.line}</p>
              <TopicLinks tags={p.topic ? [p.topic] : []} className="mt-4" />
            </div>
          </li>
        ))}
      </ol>
      {emailConfigured() && (
        <div className="pt-10">
          <SubscribeForm />
        </div>
      )}
      <p className="py-10 text-sm text-muted-foreground">
        <Link href="/reading/weekly" className="underline underline-offset-4">
          All weekly lists
        </Link>
        {" · "}
        <a href="/reading/weekly/rss.xml" className="underline underline-offset-4">
          RSS
        </a>
        {" · "}
        <Link href="/certifications" className="underline underline-offset-4">
          Everything on the reading list
        </Link>
      </p>
    </Container>
  );
}
