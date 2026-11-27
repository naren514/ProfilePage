import { OG_SIZE, shareCard } from "@/lib/og-card";
import { weeklyList, weekLabel } from "@/lib/reading/shortlist";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Share card for a weekly reading list";

export default async function Image({ params }: { params: Promise<{ week: string }> | { week: string } }) {
  const { week } = await Promise.resolve(params);
  const list = /^\d{4}-W\d{2}$/.test(week) ? await weeklyList(week).catch(() => null) : null;
  if (!list) return shareCard({ eyebrow: "Worth your time", title: "Weekly reading list" });
  return shareCard({
    eyebrow: `Worth your time · ${weekLabel(list.week)}`,
    title: list.title || `${list.picks.length} pieces worth your time`,
    lines: list.picks.map((p) => `${p.title} · ${p.publisher}`),
    footer: `${list.picks.length} picks`,
  });
}
