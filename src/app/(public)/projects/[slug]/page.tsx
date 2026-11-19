import { Metadata } from "next";
import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { ArrowLink, Container, PageHeader, TagList } from "@/components/site/ui";
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

function STARSection({ label, content }: { label: string; content: string }) {
  return (
    <section className="grid gap-x-10 gap-y-3 border-t py-10 sm:grid-cols-[9rem_minmax(0,1fr)]">
      <h2 className="pt-1.5 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</h2>
      <p className="max-w-2xl whitespace-pre-line text-pretty font-serif text-xl leading-[1.65] text-foreground/85">{content}</p>
    </section>
  );
}

export default async function ProjectPage({ params }: Props) {
  const { slug } = await params;
  const project = await getProject(slug);

  if (!project) {
    notFound();
  }

  const hasSTAR = project.situation || project.task || project.action || project.result || project.lessonsLearned;
  const meta = [project.company, project.role].filter(Boolean).join(" · ");

  return (
    <Container size="narrow">
      <div className="pt-10 sm:pt-14">
        <Link href="/projects" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          All case studies
        </Link>
      </div>

      <PageHeader eyebrow={meta || (project.isFeatured ? "Featured case study" : "Case study")} title={project.title} className="pt-10 sm:pt-14">
        <p className="mt-8 max-w-2xl text-pretty font-serif text-2xl italic leading-snug text-foreground/70">{project.summary}</p>
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
          <TagList items={project.technologies} />
          {project.websiteUrl && (
            <ArrowLink href={project.websiteUrl} external>
              Visit the project
            </ArrowLink>
          )}
        </div>
      </PageHeader>

      {project.result && (
        <aside className="mb-12 rounded-3xl bg-brand-soft px-7 py-8 sm:px-10" aria-label="Outcome at a glance">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-brand">Outcome</p>
          <p className="mt-3 text-pretty font-serif text-2xl leading-snug sm:text-[1.75rem]">{project.result}</p>
        </aside>
      )}

      {hasSTAR && (
        <div className="border-b">
          {project.situation && <STARSection label="Context" content={project.situation} />}
          {project.task && <STARSection label="Objective" content={project.task} />}
          {project.action && <STARSection label="Approach" content={project.action} />}
          {project.lessonsLearned && <STARSection label="Lessons learned" content={project.lessonsLearned} />}
        </div>
      )}
      <ChatWidget />
    </Container>
  );
}
