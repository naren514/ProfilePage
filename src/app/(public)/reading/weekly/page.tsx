import { Metadata } from "next";
import Link from "next/link";
import { Container, EmptyState, PageHeader } from "@/components/site/ui";
import { weeklyLists, weekLabel } from "@/lib/reading/shortlist";
import type { ReadingWeeklyList } from "@/lib/db/schema";

export const metadata: Metadata = {
  title: "Weekly reading lists",
  description: "Each week, a few articles worth your time, with a line on why.",
};

export const dynamic = "force-dynamic";

async function lists(): Promise<ReadingWeeklyList[]> {
  try {
    return await weeklyLists(104);
  } catch {
    return []; // before the database update has run
  }
}

export default async function WeeklyIndexPage() {
  const rows = await lists();
  return (
    <Container size="narrow">
      <PageHeader eyebrow={<Link href="/certifications">Reading list</Link>} title="Weekly lists" description="Each week, a handful of articles worth your time, with a line on why." />
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
