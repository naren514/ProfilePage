import { Badge } from "@/components/ui/badge";
import { SkillCategory } from "@/lib/settings";
import { cn } from "@/lib/utils";

interface SkillsProps {
  settings: SkillCategory[];
}

export function Skills({ settings }: SkillsProps) {
  return (
    <section className="border-t border-border/40 bg-muted/40 py-12 md:py-20">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Core Capabilities
          </h2>
          <p className="mt-3 text-lg text-muted-foreground">
            The technologies and domains I reach for repeatedly when shipping
            real-world systems.
          </p>
        </div>

        <div
          className={cn(
            "mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2",
            settings.length % 3 === 0 ? "lg:grid-cols-3" : "lg:grid-cols-4"
          )}
        >
          {settings.map((category, index) => (
            <div
              key={index}
              className="space-y-4 rounded-2xl border border-border/60 bg-background p-5 sm:p-6"
            >
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
