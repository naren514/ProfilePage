import { cn } from "@/lib/utils";

/** Page title, one line of purpose, and actions on the right. */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-4", className)}>
      <div className="min-w-0 space-y-1.5">
        <h1 className="font-serif text-[2.5rem] font-medium leading-none tracking-tight">{title}</h1>
        {description && <p className="max-w-xl text-[0.9375rem] text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Small status marker: a dot and a word, instead of a heavy badge. */
export function StatusDot({
  status,
  unpublishedChanges,
  compact,
  className,
}: {
  status: string;
  unpublishedChanges?: boolean;
  /** Shorter wording for tight places (the editor's top bar). */
  compact?: boolean;
  className?: string;
}) {
  const published = status === "PUBLISHED";
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
      <span
        aria-hidden
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          published ? (unpublishedChanges ? "bg-amber-500" : "bg-emerald-500") : "border border-muted-foreground/60"
        )}
      />
      {published ? (unpublishedChanges ? (compact ? "Unpublished changes" : "Published · unpublished changes") : "Published") : "Draft"}
    </span>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}

/** Section label used across Studio pages. */
export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground", className)}>{children}</p>;
}
