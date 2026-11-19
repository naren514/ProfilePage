import Link from "next/link";
import { Metadata } from "next";
import { ArrowRight, Briefcase, FileText, FlaskConical } from "lucide-react";
import { Container, PageHeader, SectionHeader } from "@/components/site/ui";
import { getSiteSettings } from "@/lib/settings";
import { profileUrl } from "@/lib/utils";

export const metadata: Metadata = {
  title: "For Recruiters",
  description: "Quick assessment tools and key information for recruiters evaluating this candidate",
};

export const dynamic = "force-dynamic";

export default async function ForRecruitersPage() {
  const settings = await getSiteSettings();
  const keyStats =
    settings.hero?.stats?.filter((stat) => stat.label?.trim() || stat.value?.trim()) ?? [];
  const skillCategories = settings.skills ?? [];
  const email = settings.contact?.email?.trim();
  const linkedin = settings.contact?.linkedin?.trim();
  const linkedinUrl = linkedin ? profileUrl(linkedin, "https://linkedin.com/in/") : null;

  const links = [
    { href: "/projects", title: "Case studies", body: "Major projects, from the problem to the measured outcome.", icon: Briefcase },
    { href: "/experience", title: "Work history", body: "Every role, with responsibilities and results.", icon: FileText },
    { href: "/lab", title: "Lab", body: "Open-source tools for OTM, EDI and supply chain teams.", icon: FlaskConical },
  ];

  return (
    <Container>
      <PageHeader
        eyebrow="For recruiters"
        title="The short version"
        description="Key qualifications, case studies and work history in one place, so you can judge fit for your role quickly."
      />

      {keyStats.length > 0 && (
        <dl className="grid grid-cols-2 border-y sm:grid-cols-4">
          {keyStats.map((stat) => (
            <div
              key={stat.label}
              className="flex flex-col-reverse gap-2 py-7 pr-4 [&:nth-child(even)]:border-l [&:nth-child(even)]:pl-6 sm:[&:not(:first-child)]:border-l sm:[&:not(:first-child)]:pl-6"
            >
              <dt className="text-sm text-muted-foreground">{stat.label}</dt>
              <dd className="font-serif text-5xl tracking-[-0.02em] tabular-nums">{stat.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {skillCategories.length > 0 && (
        <section className="mt-20">
          <SectionHeader title="Core skills" />
          <dl className="grid gap-x-10 sm:grid-cols-2">
            {skillCategories.map((category) => (
              <div key={category.name} className="grid gap-2 border-b py-5 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-6">
                <dt className="pt-0.5 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{category.name}</dt>
                <dd className="text-[0.9375rem] leading-relaxed">{category.skills.join(", ")}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <section className="mt-20">
        <SectionHeader title="Go deeper" />
        <div className="grid gap-4 md:grid-cols-3">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="site-motion group flex flex-col rounded-3xl bg-muted/50 p-7 ring-1 ring-inset ring-border/60 transition-all hover:-translate-y-1 hover:bg-background hover:shadow-[0_20px_50px_-24px_rgba(0,0,0,0.25)]"
            >
              <l.icon className="h-5 w-5 text-muted-foreground" aria-hidden />
              <h3 className="mt-8 font-serif text-2xl">{l.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{l.body}</p>
              <ArrowRight className="site-motion mt-6 h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
            </Link>
          ))}
        </div>
      </section>

      {(email || linkedinUrl) && (
        <section className="mt-20 flex flex-col gap-6 rounded-[2rem] bg-foreground px-7 py-12 text-background sm:flex-row sm:items-center sm:justify-between sm:px-12">
          <div>
            <h2 className="font-serif text-4xl">Ready to talk?</h2>
            <p className="mt-2 text-background/60">Questions, or an opportunity to discuss.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {email && (
              <a href={`mailto:${email}`} className="inline-flex h-11 items-center rounded-full bg-background px-6 text-sm font-medium text-foreground hover:bg-background/90">
                Send an email
              </a>
            )}
            {linkedinUrl && (
              <a
                href={linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center rounded-full border border-background/25 px-6 text-sm font-medium hover:bg-background/10"
              >
                LinkedIn profile
              </a>
            )}
          </div>
        </section>
      )}
    </Container>
  );
}
