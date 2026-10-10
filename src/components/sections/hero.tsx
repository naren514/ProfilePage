import { Button } from "@/components/ui/button";
import { ArrowRight, MapPin } from "lucide-react";
import Link from "next/link";
import { HeroSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

interface HeroProps {
  settings: HeroSettings;
}

export function Hero({ settings }: HeroProps) {
  const name = settings.name?.trim();
  const role = settings.title?.trim();
  const subtitle = settings.subtitle?.trim();
  const location = settings.location?.trim();
  const stats = settings.stats?.filter((stat) => stat.label?.trim() || stat.value?.trim()) ?? [];

  return (
    <section className="relative overflow-hidden pt-28 pb-12 md:pt-36 md:pb-20">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div
          className={cn(
            "grid items-center gap-12 lg:gap-16",
            stats.length > 0 && "lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]"
          )}
        >
          <div className="flex flex-col items-start">
            {location ? (
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-4 py-2 text-sm text-muted-foreground backdrop-blur-sm">
                <MapPin className="h-4 w-4" />
                <span>{location}</span>
              </div>
            ) : null}

            <h1 className="text-balance text-5xl font-semibold tracking-tight text-foreground sm:text-6xl xl:text-7xl">
              {name || role || "Professional Portfolio"}
            </h1>

            {role && role !== name ? (
              <p className="mt-5 text-balance text-xl font-medium leading-8 text-foreground/80 md:text-2xl md:leading-9">
                {role}
              </p>
            ) : null}

            {subtitle ? (
              <p className="mt-5 max-w-2xl text-pretty text-base leading-7 text-muted-foreground md:text-lg md:leading-8">
                {subtitle}
              </p>
            ) : null}

            <div className="mt-8 flex w-full gap-3 sm:w-auto">
              <Link href="/projects" className="flex-1 sm:flex-none">
                <Button size="lg" className="w-full sm:w-auto">
                  View Work
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/experience" className="flex-1 sm:flex-none">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  Experience
                </Button>
              </Link>
            </div>
          </div>

          {stats.length > 0 ? (
            <dl className="grid grid-cols-2 gap-4">
              {stats.map((stat, index) => (
                <div
                  key={index}
                  className="flex flex-col-reverse justify-end gap-2 rounded-2xl border border-border/60 bg-card/60 p-5 backdrop-blur-sm sm:p-6"
                >
                  <dt className="text-sm leading-5 text-muted-foreground">{stat.label}</dt>
                  <dd className="text-3xl font-semibold tracking-tight sm:text-4xl">
                    {stat.value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      </div>

      <div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80">
        <div
          className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[28deg] bg-gradient-to-tr from-muted/20 to-muted/5 opacity-30 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"
          style={{
            clipPath:
              "polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)",
          }}
        />
      </div>
    </section>
  );
}
