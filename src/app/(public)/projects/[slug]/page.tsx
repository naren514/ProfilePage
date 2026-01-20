import { Metadata } from "next";
import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Building2, Calendar, User } from "lucide-react";
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

  const starSections = [
    { title: "Situation", content: project.situation, icon: "S" },
    { title: "Task", content: project.task, icon: "T" },
    { title: "Action", content: project.action, icon: "A" },
    { title: "Result", content: project.result, icon: "R" },
  ];

  return (
    <div className="pt-24 pb-16">
      <div className="mx-auto max-w-4xl px-6 lg:px-8">
        {/* Back button */}
        <Link href="/projects">
          <Button variant="ghost" className="mb-8 -ml-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Projects
          </Button>
        </Link>

        {/* Header */}
        <div className="space-y-4">
          {project.isFeatured && (
            <Badge variant="secondary">Featured Project</Badge>
          )}
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {project.title}
          </h1>

          <div className="flex flex-wrap items-center gap-6 text-muted-foreground">
            {project.company && (
              <span className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                {project.company}
              </span>
            )}
            {project.role && (
              <span className="flex items-center gap-2">
                <User className="h-5 w-5" />
                {project.role}
              </span>
            )}
            {project.startDate && (
              <span className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                {new Date(project.startDate).getFullYear()}
                {project.endDate && ` - ${new Date(project.endDate).getFullYear()}`}
              </span>
            )}
          </div>

          <p className="text-lg text-muted-foreground">{project.summary}</p>

          {/* Technologies */}
          <div className="flex flex-wrap gap-2 pt-2">
            {project.technologies.map((tech) => (
              <Badge key={tech} variant="outline">
                {tech}
              </Badge>
            ))}
          </div>
        </div>

        {/* STAR Format Sections */}
        <div className="mt-12 space-y-6">
          {starSections.map((section) => (
            <Card key={section.title} className="bg-card/50 border-border/60">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
                    {section.icon}
                  </span>
                  {section.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground whitespace-pre-line">
                  {section.content}
                </p>
              </CardContent>
            </Card>
          ))}

          {/* Lessons Learned */}
          {project.lessonsLearned && (
            <Card className="bg-card/50 border-border/60">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-secondary-foreground text-sm font-bold">
                    L
                  </span>
                  Lessons Learned
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground whitespace-pre-line">
                  {project.lessonsLearned}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      <ChatWidget />
    </div>
  );
}
