import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import { HeroSettings } from "@/lib/settings";
import { Container, pillPrimary, pillSecondary } from "@/components/site/ui";

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
    <section className="relative isolate overflow-hidden">
      {/* A single soft wash of the logo colour; everything else is type */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-40 -z-10 mx-auto h-[36rem] max-w-5xl rounded-full bg-[radial-gradient(closest-side,hsl(var(--brand)/0.10),transparent)] blur-2xl"
      />
      <Container className="pb-16 pt-16 sm:pb-24 sm:pt-28">
        {location && (
          <p className="mb-8 inline-flex items-center gap-2 rounded-full border bg-background/70 px-3.5 py-1.5 text-sm text-muted-foreground backdrop-blur">
            <MapPin className="h-3.5 w-3.5" aria-hidden />
            {location}
          </p>
        )}

        <h1 className="max-w-4xl text-balance font-serif text-6xl font-normal leading-[0.98] tracking-[-0.03em] sm:text-7xl lg:text-[5.5rem]">
          {name || role || "Professional Portfolio"}
        </h1>

        {role && role !== name && (
          <p className="mt-5 max-w-3xl text-balance font-serif text-2xl italic text-foreground/70 sm:text-3xl">{role}</p>
        )}

        {subtitle && <p className="mt-8 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground">{subtitle}</p>}

        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/projects" className={pillPrimary}>
            See the work
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link href="/experience" className={pillSecondary}>
            Experience
          </Link>
        </div>

        {stats.length > 0 && (
          <dl className="mt-20 grid grid-cols-2 border-t sm:grid-cols-4">
            {stats.map((stat, index) => (
              <div
                key={index}
                className="flex flex-col-reverse gap-2 border-b py-6 pr-4 sm:border-b-0 sm:py-8 sm:[&:not(:first-child)]:border-l sm:[&:not(:first-child)]:pl-6"
              >
                <dt className="text-sm leading-snug text-muted-foreground">{stat.label}</dt>
                <dd className="font-serif text-5xl tracking-[-0.02em] tabular-nums">{stat.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {companies.length > 0 && (
          <div className="mt-8 flex flex-wrap items-baseline gap-x-6 gap-y-2 text-sm">
            <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Recent work with</span>
            {companies.map((company) => (
              <span key={company} className="text-foreground/80">
                {company}
              </span>
            ))}
          </div>
        )}
      </Container>
    </section>
  );
}
