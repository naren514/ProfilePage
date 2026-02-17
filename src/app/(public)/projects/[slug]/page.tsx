import { Metadata } from "next";
import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ExternalLink } from "lucide-react";
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

export default async function ProjectPage({ params }: Props) {
  const { slug } = await params;
  const project = await getProject(slug);

  if (!project) {
    notFound();
  }

  return (
    <div className="pt-24 pb-16">
      <div className="mx-auto max-w-4xl px-6 lg:px-8">
        {/* Back button */}
        <Link href="/projects">
          <Button variant="ghost" className="mb-8 -ml-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Work
          </Button>
        </Link>

        {/* Header */}
        <div className="space-y-6">
          {project.isFeatured && (
            <Badge variant="secondary">Featured Project</Badge>
          )}
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {project.title}
          </h1>

          {/* Summary */}
          <p className="text-lg text-muted-foreground leading-relaxed">
            {project.summary}
          </p>

          {/* Technologies */}
          <div className="flex flex-wrap gap-2">
            {project.technologies.map((tech) => (
              <Badge key={tech} variant="outline">
                {tech}
              </Badge>
            ))}
          </div>

          {/* Website URL */}
          {project.websiteUrl && (
            <div className="pt-4">
              <a
                href={project.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-primary hover:underline"
              >
                <ExternalLink className="h-4 w-4" />
                Visit Project
              </a>
            </div>
          )}
        </div>
      </div>
      <ChatWidget />
    </div>
  );
}
