import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { type Project } from "@/lib/db/schema";
import { TagList } from "@/components/site/ui";

interface ProjectCardProps {
  project: Project;
}

export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <Link
      href={`/projects/${project.slug}`}
      className="site-motion group flex h-full flex-col rounded-3xl bg-muted/50 p-7 ring-1 ring-inset ring-border/60 transition-all duration-300 hover:-translate-y-1 hover:bg-background hover:shadow-[0_20px_50px_-24px_rgba(0,0,0,0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span className="truncate font-medium uppercase tracking-[0.12em]">{project.company}</span>
        {project.isFeatured && (
          <span className="inline-flex shrink-0 items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden />
            Featured
          </span>
        )}
      </div>

      <h3 className="mt-4 text-balance font-serif text-[1.75rem] leading-[1.15] tracking-[-0.01em]">{project.title}</h3>

      <p className="mt-3 line-clamp-3 text-pretty text-[0.9375rem] leading-relaxed text-muted-foreground">{project.summary}</p>

      <TagList items={project.technologies} max={4} className="mt-6" />

      <span className="mt-auto inline-flex items-center gap-1.5 pt-8 text-sm font-medium">
        Read the case study
        <ArrowRight className="site-motion h-3.5 w-3.5 transition-transform group-hover:translate-x-1" aria-hidden />
      </span>
    </Link>
  );
}
