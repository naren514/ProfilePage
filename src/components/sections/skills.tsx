import { Badge } from "@/components/ui/badge";
import { SkillCategory } from "@/lib/settings";

interface SkillsProps {
  settings: SkillCategory[];
}

export function Skills({ settings }: SkillsProps) {
  return (
    <section className="pb-10 md:pb-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 rounded-3xl border border-border/60 bg-background p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2.4fr)] lg:gap-12 lg:p-10">
          <div>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Core Capabilities
            </h2>
            <p className="mt-3 text-base text-muted-foreground">
              The technologies and domains I reach for repeatedly when shipping
              real-world systems.
            </p>
          </div>

          <dl className="divide-y divide-border/60">
            {settings.map((category, index) => (
              <div
                key={index}
                className="grid gap-3 py-4 first:pt-0 last:pb-0 sm:grid-cols-[13rem_minmax(0,1fr)] sm:gap-6"
              >
                <dt className="pt-0.5 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  {category.name}
                </dt>
                <dd className="flex flex-wrap gap-2">
                  {category.skills.map((skill, skillIndex) => (
                    <Badge key={skillIndex} variant="secondary">
                      {skill}
                    </Badge>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
