import Link from "next/link";
import { ArrowUpRight, Github } from "lucide-react";
import type { LabEntry } from "@/lib/settings";
import { TagList } from "./ui";

/** One open-source tool. Used on the home page and the Lab page. */
export function LabCard({ tool, index }: { tool: LabEntry; index?: number }) {
  return (
    <article className="flex h-full flex-col rounded-3xl border p-7">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-mono tabular-nums">{index !== undefined ? String(index + 1).padStart(2, "0") : ""}</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
          Open source
        </span>
      </div>

      <h3 className="mt-5 font-serif text-2xl leading-tight tracking-[-0.01em]">{tool.title}</h3>
      <p className="mt-3 text-pretty text-[0.9375rem] leading-relaxed text-muted-foreground">{tool.description}</p>

      <TagList items={tool.technologies} max={4} className="mt-6" />

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-8">
        {tool.liveUrl && (
          <Link
            href={tool.liveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-foreground px-4 text-sm font-medium text-background transition-colors hover:bg-foreground/85"
          >
            Try it
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            <span className="sr-only">(live demo of {tool.title})</span>
          </Link>
        )}
        <Link
          href={tool.githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors hover:bg-muted"
        >
          <Github className="h-3.5 w-3.5" aria-hidden />
          Source
          <span className="sr-only">(GitHub repository for {tool.title})</span>
        </Link>
      </div>
    </article>
  );
}
