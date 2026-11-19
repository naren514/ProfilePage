import { SkillCategory } from "@/lib/settings";
import { Container, SectionHeader } from "@/components/site/ui";

interface SkillsProps {
  settings: SkillCategory[];
}

export function Skills({ settings }: SkillsProps) {
  return (
    <section className="py-12 sm:py-16">
      <Container>
        <SectionHeader title="What I work with" description="The platforms and practices I reach for when shipping real systems." />
        <dl className="grid grid-cols-1 gap-x-10 sm:grid-cols-2">
          {settings.map((category, index) => (
            <div key={index} className="grid min-w-0 grid-cols-1 gap-2 border-b py-5 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-6">
              <dt className="pt-0.5 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{category.name}</dt>
              <dd className="flex min-w-0 flex-wrap text-[0.9375rem] leading-relaxed">
                {category.skills.map((skill, i) => (
                  <span key={i} className="whitespace-nowrap">
                    {skill}
                    {i < category.skills.length - 1 && (
                      <span className="mx-2 text-muted-foreground/50" aria-hidden>
                        /
                      </span>
                    )}
                    {i < category.skills.length - 1 && <span className="sr-only">,</span>}
                  </span>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      </Container>
    </section>
  );
}
