import { Badge } from "@/components/ui/badge";
import { SkillCategory } from "@/lib/settings";

interface SkillsProps {
  settings: SkillCategory[];
}

export function Skills({ settings }: SkillsProps) {
  return (
    <section className="py-20 md:py-32 border-t border-border/40">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Core Capabilities
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            The technologies and domains I reach for repeatedly when shipping
            real-world systems.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-4xl grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {settings.map((category, index) => (
            <div key={index} className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                {category.name}
              </h3>
              <div className="flex flex-wrap gap-2">
                {category.skills.map((skill, skillIndex) => (
                  <Badge key={skillIndex} variant="secondary">
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
