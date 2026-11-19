import { Metadata } from "next";
import { unstable_noStore as noStore } from "next/cache";
import { db } from "@/lib/db";
import { experiences } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { Container, EmptyState, PageHeader, SectionHeader, TagList, formatMonthYear } from "@/components/site/ui";
import { ChatWidget } from "@/components/chat/chat-widget";
import { getSiteSettings, getCertificationsSettings, getEducationSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Experience",
  description: "Professional experience in technology, cloud architecture, and software development.",
};

export const dynamic = "force-dynamic";

async function getExperiences() {
  noStore();
  try {
    return await db
      .select()
      .from(experiences)
      .orderBy(desc(experiences.isCurrent), desc(experiences.startDate));
  } catch {
    return [];
  }
}

function years(start: string, end: string | null, current: boolean) {
  const a = new Date(start).getUTCFullYear();
  const b = current || !end ? null : new Date(end).getUTCFullYear();
  return b === null ? `${a} – now` : a === b ? String(a) : `${a} – ${b}`;
}

const EMPLOYMENT: Record<string, string> = { "full-time": "Full-time", "part-time": "Part-time", contract: "Contract", freelance: "Freelance", internship: "Internship" };

export default async function ExperiencePage() {
  const [experienceList, settings] = await Promise.all([getExperiences(), getSiteSettings()]);
  const certList = getCertificationsSettings(settings);
  const eduList = getEducationSettings(settings);

  return (
    <Container size="narrow">
      <PageHeader eyebrow="Experience" title="Where I've worked" description="Roles, responsibilities and results, most recent first." />

      {experienceList.length > 0 ? (
        <ol className="border-t">
          {experienceList.map((exp) => (
            <li key={exp.id} className="grid gap-x-10 gap-y-3 border-b py-10 sm:grid-cols-[9rem_minmax(0,1fr)]">
              <div className="space-y-1 pt-1.5 text-sm text-muted-foreground">
                <p className="tabular-nums text-foreground">{years(exp.startDate, exp.endDate, exp.isCurrent)}</p>
                <p>
                  {formatMonthYear(exp.startDate)} – {exp.isCurrent ? "Present" : formatMonthYear(exp.endDate)}
                </p>
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <h2 className="font-serif text-[1.75rem] leading-tight tracking-[-0.01em]">{exp.title}</h2>
                  {exp.isCurrent && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-medium text-brand">
                      <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden />
                      Current
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[0.9375rem]">
                  {exp.company}
                  <span className="text-muted-foreground">
                    {exp.location && ` · ${exp.location}`}
                    {exp.employmentType && ` · ${EMPLOYMENT[exp.employmentType] ?? exp.employmentType}`}
                  </span>
                </p>

                {exp.description && <p className="mt-5 max-w-2xl text-pretty leading-relaxed text-muted-foreground">{exp.description}</p>}

                {exp.achievements && exp.achievements.length > 0 && (
                  <ul className="mt-5 max-w-2xl space-y-2" aria-label="Key achievements">
                    {exp.achievements.map((achievement, i) => (
                      <li key={i} className="relative pl-5 text-[0.9375rem] leading-relaxed before:absolute before:left-0 before:top-[0.7em] before:h-px before:w-2.5 before:bg-foreground/40">
                        {achievement}
                      </li>
                    ))}
                  </ul>
                )}

                {exp.technologies && exp.technologies.length > 0 && <TagList items={exp.technologies} className="mt-6" />}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState>The timeline is on its way.</EmptyState>
      )}

      {certList.length > 0 && (
        <section className="mt-20">
          <SectionHeader title="Certifications" className="mb-0" />
          <ul className="border-t">
            {certList.map((cert, i) => (
              <li key={i} className="grid gap-x-10 gap-y-1 border-b py-5 sm:grid-cols-[9rem_minmax(0,1fr)]">
                <span className="text-sm tabular-nums text-muted-foreground">{cert.year}</span>
                <span>
                  <span className="font-medium">{cert.name}</span>
                  <span className="text-muted-foreground"> · {cert.issuer}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {eduList.length > 0 && (
        <section className="mt-20">
          <SectionHeader title="Education" className="mb-0" />
          <ul className="border-t">
            {eduList.map((edu, i) => (
              <li key={i} className="grid gap-x-10 gap-y-1 border-b py-5 sm:grid-cols-[9rem_minmax(0,1fr)]">
                <span className="text-sm tabular-nums text-muted-foreground">{edu.year}</span>
                <span>
                  <span className="font-medium">{edu.degree}</span>
                  <span className="text-muted-foreground"> · {edu.institution}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <ChatWidget />
    </Container>
  );
}
