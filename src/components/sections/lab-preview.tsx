import Link from "next/link";
import { ArrowRight, Github, Globe } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LabEntry } from "@/lib/settings";

interface LabPreviewProps {
  tools: LabEntry[];
}

const PREVIEW_COUNT = 3;

export function LabPreview({ tools }: LabPreviewProps) {
  if (tools.length === 0) return null;

  const preview = [...tools]
    .sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99))
    .slice(0, PREVIEW_COUNT);
  const viewAllLabel =
    tools.length > PREVIEW_COUNT ? `View All ${tools.length} Tools` : "Visit the Lab";

  return (
    <section className="pb-10 md:pb-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-8">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">From the Lab</h2>
            <p className="mt-2 text-base text-muted-foreground">
              Open-source tools built for Oracle OTM, EDI, parcel shipping, and supply chain
              teams — scratching itches that commercial platforms don&apos;t.
            </p>
          </div>
          <Link href="/lab" className="hidden shrink-0 sm:block">
            <Button variant="outline" className="bg-background">
              {viewAllLabel}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-5">
          {preview.map((tool) => (
            <div
              key={tool.githubUrl}
              className="flex flex-col gap-4 rounded-xl border border-border/60 bg-card p-6 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-lg font-semibold leading-snug">{tool.title}</h3>
                <Badge variant="secondary" className="shrink-0">
                  Open source
                </Badge>
              </div>

              <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                {tool.description}
              </p>

              <div className="flex flex-wrap gap-1.5">
                {tool.technologies.slice(0, 4).map((tech) => (
                  <Badge key={tech} variant="outline" className="text-xs">
                    {tech}
                  </Badge>
                ))}
              </div>

              <div className="mt-auto flex items-center gap-5 pt-2 text-sm font-medium">
                <Link
                  href={tool.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 hover:underline underline-offset-4"
                >
                  <Github className="h-4 w-4" />
                  GitHub
                </Link>
                {tool.liveUrl && (
                  <Link
                    href={tool.liveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 hover:underline underline-offset-4"
                  >
                    <Globe className="h-4 w-4" />
                    Live Demo
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 sm:hidden">
          <Link href="/lab">
            <Button size="lg" variant="outline" className="w-full bg-background">
              {viewAllLabel}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
