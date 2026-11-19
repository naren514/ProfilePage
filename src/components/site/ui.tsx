import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Shared building blocks for the public site: one container width, one heading style. */

export function Container({ children, className, size = "default" }: { children: React.ReactNode; className?: string; size?: "default" | "narrow" | "reading" }) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-5 sm:px-8",
        size === "default" && "max-w-6xl",
        size === "narrow" && "max-w-4xl",
        size === "reading" && "max-w-[42rem]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground", className)}>{children}</p>;
}

/** Page title block: eyebrow, large serif title, one line of purpose. */
export function PageHeader({
  eyebrow,
  title,
  description,
  children,
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("max-w-3xl pb-12 pt-16 sm:pb-16 sm:pt-24", className)}>
      {eyebrow && <Eyebrow className="mb-5">{eyebrow}</Eyebrow>}
      <h1 className="text-balance font-serif text-5xl font-normal leading-[1.02] tracking-[-0.02em] sm:text-6xl">{title}</h1>
      {description && <p className="mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground">{description}</p>}
      {children}
    </header>
  );
}

/** Section heading with an optional link on the right. */
export function SectionHeader({
  title,
  description,
  href,
  linkLabel,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  href?: string;
  linkLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn("mb-8 flex flex-wrap items-end justify-between gap-x-8 gap-y-3 border-t pt-6", className)}>
      <div className="max-w-2xl">
        <h2 className="font-serif text-3xl font-normal tracking-[-0.01em] sm:text-[2.25rem]">{title}</h2>
        {description && <p className="mt-2 text-pretty text-[0.9375rem] leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      {href && linkLabel && <ArrowLink href={href}>{linkLabel}</ArrowLink>}
    </div>
  );
}

export function ArrowLink({ href, children, external, className }: { href: string; children: React.ReactNode; external?: boolean; className?: string }) {
  const Icon = external ? ArrowUpRight : ArrowRight;
  return (
    <Link
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={cn(
        "group inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline-offset-4 hover:underline",
        className
      )}
    >
      {children}
      <Icon className="site-motion h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}

/** Quiet technology / topic label. */
export function Tag({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground", className)}>
      {children}
    </span>
  );
}

export function TagList({ items, max, className }: { items: string[]; max?: number; className?: string }) {
  const unique = Array.from(new Set(items));
  const shown = max ? unique.slice(0, max) : unique;
  if (shown.length === 0) return null;
  return (
    <ul className={cn("flex flex-wrap gap-1.5", className)} aria-label="Topics">
      {shown.map((t) => (
        <li key={t}>
          <Tag>{t}</Tag>
        </li>
      ))}
      {max && unique.length > max && (
        <li>
          <Tag>+{unique.length - max}</Tag>
        </li>
      )}
    </ul>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-dashed px-6 py-16 text-center">
      <p className="font-serif text-xl text-muted-foreground">{children}</p>
    </div>
  );
}

/** Pill buttons used across the public site. */
export const pillPrimary =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-foreground px-6 text-sm font-medium text-background transition-colors hover:bg-foreground/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
export const pillSecondary =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full border bg-background px-6 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export function formatMonthYear(date: string | null | undefined) {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

export function formatDay(date: string | null | undefined, month: "short" | "long" = "short") {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en-US", { month, day: "numeric", year: "numeric", timeZone: "UTC" });
}
