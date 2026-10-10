import { Button } from "@/components/ui/button";
import { ArrowRight, MapPin } from "lucide-react";
import Link from "next/link";
import { HeroSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

interface HeroProps {
  settings: HeroSettings;
  companies?: string[];
}

export function Hero({ settings, companies = [] }: HeroProps) {
  const name = settings.name?.trim();
  const role = settings.title?.trim();
  const subtitle = settings.subtitle?.trim();
  const location = settings.location?.trim();
  const stats = settings.stats?.filter((stat) => stat.label?.trim() || stat.value?.trim()) ?? [];

  return (
    <section className="pt-20 sm:pt-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Panel colours follow the logo: navy ground, indigo-to-violet accent */}
        <div className="relative isolate overflow-hidden rounded-3xl bg-gradient-to-br from-[#1a1a2e] to-[#16213e] px-6 py-10 text-white shadow-xl sm:px-10 sm:py-12 lg:px-14 lg:py-12">
          <div className="absolute -right-10 -top-24 -z-10 h-80 w-80 rounded-full bg-[#7c3aed]/30 blur-3xl" />
          <div className="absolute -bottom-32 -left-16 -z-10 h-80 w-80 rounded-full bg-[#4f46e5]/25 blur-3xl" />
          <div className="absolute right-0 top-0 -z-10 w-[60rem] translate-x-1/3 rotate-[28deg] opacity-25 blur-3xl">
            <div
              className="aspect-[1155/678] w-full bg-gradient-to-tr from-[#4f46e5] to-[#7c3aed]"
              style={{
                clipPath:
                  "polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)",
              }}
            />
          </div>

          <div
            className={cn(
              "grid items-center gap-10 lg:gap-14",
              stats.length > 0 && "lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]"
            )}
          >
            <div className="flex flex-col items-start">
              {location ? (
                <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-sm text-white/70 backdrop-blur-sm">
                  <MapPin className="h-4 w-4" />
                  <span>{location}</span>
                </div>
              ) : null}

              <h1 className="text-balance text-5xl font-semibold tracking-tight sm:text-6xl">
                {name || role || "Professional Portfolio"}
              </h1>

              {role && role !== name ? (
                <p className="mt-4 text-balance text-xl font-medium leading-8 text-white/85 md:text-2xl">
                  {role}
                </p>
              ) : null}

              {subtitle ? (
                <p className="mt-4 max-w-2xl text-pretty text-base leading-7 text-white/65 md:text-lg md:leading-8">
                  {subtitle}
                </p>
              ) : null}

              <div className="mt-8 flex w-full gap-3 sm:w-auto">
                <Link href="/projects" className="flex-1 sm:flex-none">
                  <Button
                    size="lg"
                    className="w-full bg-white text-[#1a1a2e] hover:bg-white/90 sm:w-auto"
                  >
                    View Work
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/experience" className="flex-1 sm:flex-none">
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white sm:w-auto"
                  >
                    Experience
                  </Button>
                </Link>
              </div>
            </div>

            {stats.length > 0 ? (
              <dl className="grid grid-cols-2 gap-3 sm:gap-4">
                {stats.map((stat, index) => (
                  <div
                    key={index}
                    className="flex flex-col-reverse justify-end gap-1.5 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm"
                  >
                    <dt className="text-sm leading-5 text-white/60">{stat.label}</dt>
                    <dd className="bg-gradient-to-r from-white to-violet-200 bg-clip-text text-3xl font-semibold tracking-tight text-transparent sm:text-4xl">
                      {stat.value}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>

          {companies.length > 0 ? (
            <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-white/10 pt-6 text-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-white/40">
                Recent work with
              </span>
              {companies.map((company) => (
                <span key={company} className="font-medium text-white/80">
                  {company}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
