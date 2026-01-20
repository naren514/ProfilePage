import { Card, CardContent } from "@/components/ui/card";
import { Cloud, Shield, Users, Sparkles, LucideIcon } from "lucide-react";
import { AboutSettings } from "@/lib/settings";

interface AboutProps {
  settings: AboutSettings;
}

// Map feature names to icons (fallback to Sparkles if not found)
const iconMap: Record<string, LucideIcon> = {
  "Cloud Architecture": Cloud,
  "Security Excellence": Shield,
  "Team Leadership": Users,
  "GenAI Innovation": Sparkles,
};

function getIconForFeature(featureName: string): LucideIcon {
  // Check for partial matches
  const lowerName = featureName.toLowerCase();
  if (lowerName.includes("cloud") || lowerName.includes("architecture")) return Cloud;
  if (lowerName.includes("security")) return Shield;
  if (lowerName.includes("team") || lowerName.includes("leadership")) return Users;
  if (lowerName.includes("ai") || lowerName.includes("innovation")) return Sparkles;
  return iconMap[featureName] || Sparkles;
}

export function About({ settings }: AboutProps) {
  return (
    <section className="py-20 md:py-32 border-t border-border/40">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl lg:text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            About Me
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            {settings.headline}
          </h2>
          <p className="mt-6 text-lg leading-8 text-muted-foreground">
            {settings.description}
          </p>
        </div>

        <div className="mx-auto mt-16 max-w-5xl">
          <div className="grid gap-6 sm:grid-cols-2">
            {settings.features.map((feature, index) => {
              const Icon = getIconForFeature(feature.name);
              return (
                <Card key={index} className="bg-card/50 border-border/60">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <div className="rounded-lg bg-secondary p-2.5">
                        <Icon className="h-5 w-5 text-foreground" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{feature.name}</h3>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {feature.description}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
