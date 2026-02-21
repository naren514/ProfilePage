import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { HeroSettings } from "@/lib/settings";

interface HeroProps {
  settings: HeroSettings;
}

export function Hero({ settings }: HeroProps) {
  const fullName = [settings.name, settings.title]
    .filter((part) => part && part.trim().length > 0)
    .join(" ")
    .trim();

  return (
    <section className="relative pt-32 pb-20 md:pt-40 md:pb-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          {/* Main heading */}
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            {fullName || settings.title || settings.name}
          </h1>

          {/* Subtitle */}
          <p className="mt-6 text-lg leading-8 text-muted-foreground">
            {settings.subtitle}
          </p>

          {/* CTA buttons */}
          <div className="mt-10 flex items-center justify-center">
            <Link href="/projects">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                View Work
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>

          {/* Quick stats */}
          <div className="mt-16 grid grid-cols-2 gap-8 sm:grid-cols-4">
            {settings.stats.map((stat, index) => (
              <div key={index} className="flex flex-col items-center">
                <span className="text-3xl font-bold">{stat.value}</span>
                <span className="mt-1 text-sm text-muted-foreground">
                  {stat.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Background decoration */}
      <div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80">
        <div
          className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-muted/20 to-muted/5 opacity-30 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"
          style={{
            clipPath:
              "polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)",
          }}
        />
      </div>
    </section>
  );
}
