import { Metadata } from "next";
import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Building2, ExternalLink } from "lucide-react";
import Link from "next/link";
import { ChatWidget } from "@/components/chat/chat-widget";

interface Props {
  params: Promise<{ slug: string }>;
}

async function getProject(slug: string) {
  noStore();
  try {
    const result = await db
      .select()
      .from(projects)
      .where(and(eq(projects.slug, slug), eq(projects.isPublished, true)))
      .limit(1);
    return result[0] || null;
  } catch {
    return null;
  }
}


export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const project = await getProject(slug);

  if (!project) {
    return { title: "Project Not Found" };
  }

  return {
    title: project.title,
    description: project.summary,
  };
}

interface STARSectionProps {
  label: string;
  content: string;
}

function STARSection({ label, content }: STARSectionProps) {
  return (
    <div className="relative pl-6 before:absolute before:left-0 before:top-1 before:h-5 before:w-0.5 before:rounded-full before:bg-border">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-3">
        {label}
      </h2>
      <p className="text-foreground/80 leading-relaxed whitespace-pre-line">{content}</p>
    </div>
  );
}

export default async function ProjectPage({ params }: Props) {
  const { slug } = await params;
  const project = await getProject(slug);

  if (!project) {
    notFound();
  }

  const hasSTAR = project.situation || project.task || project.action || project.result;

  return (
    <div className="pt-24 pb-16">
      <div className="mx-auto max-w-3xl px-6 lg:px-8">
        <Link href="/projects">
          <Button variant="ghost" className="mb-10 -ml-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Projects
          </Button>
        </Link>

        {/* Header */}
        <div className="space-y-4">
          {project.isFeatured && (
            <Badge variant="secondary" className="text-xs">Featured Project</Badge>
          )}

          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl leading-tight">
            {project.title}
          </h1>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            {project.company && (
              <span className="flex items-center gap-1.5">
                <Building2 className="h-4 w-4" />
                {project.company}
              </span>
            )}
            {project.role && (
              <span className="text-foreground/60">{project.role}</span>
            )}
          </div>

          {/* Summary */}
          <p className="text-lg text-muted-foreground leading-relaxed pt-2">
            {project.summary}
          </p>

          {/* Technologies */}
          {project.technologies.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {project.technologies.map((tech) => (
                <Badge key={tech} variant="outline" className="text-xs">
                  {tech}
                </Badge>
              ))}
            </div>
          )}

          {/* Website URL */}
          {project.websiteUrl && (
            <a
              href={project.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline pt-2"
            >
              <ExternalLink className="h-4 w-4" />
              View Project
            </a>
          )}
        </div>

        {/* STAR Sections */}
        {hasSTAR && (
          <div className="mt-16 space-y-12 border-t border-border/40 pt-16">
            {project.situation && (
              <STARSection label="Context" content={project.situation} />
            )}
            {project.task && (
              <STARSection label="Objective" content={project.task} />
            )}
            {project.action && (
              <STARSection label="Approach" content={project.action} />
            )}
            {project.result && (
              <STARSection label="Outcome" content={project.result} />
            )}
            {project.lessonsLearned && (
              <STARSection label="Lessons Learned" content={project.lessonsLearned} />
            )}
          </div>
        )}
      </div>
      <ChatWidget />
    </div>
  );
}
