import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { unstable_noStore as noStore } from "next/cache";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects, type Project } from "@/lib/db/schema";
import { ProjectCard } from "@/components/projects/project-card";
import { Button } from "@/components/ui/button";

async function getFeaturedProjects() {
  noStore();
  try {
    return await db
      .select()
      .from(projects)
      .where(eq(projects.isPublished, true))
      .orderBy(desc(projects.isFeatured), desc(projects.sortOrder))
      .limit(3);
  } catch {
    return [];
  }
}

export async function FeaturedProjects() {
  const featuredProjects = await getFeaturedProjects();
  return <FeaturedProjectsSection projects={featuredProjects} />;
}

export function FeaturedProjectsSection({ projects: featuredProjects }: { projects: Project[] }) {
  return (
    <section className="border-t border-border/40 py-12 md:py-20">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="flex items-end justify-between gap-8">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Featured Projects
            </h2>
            <p className="mt-3 text-lg text-muted-foreground">
              Selected work that shows how I approach architecture, delivery, and
              outcome-driven engineering.
            </p>
          </div>
          {featuredProjects.length > 0 && (
            <Link href="/projects" className="hidden shrink-0 sm:block">
              <Button variant="outline">
                View All Projects
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          )}
        </div>

        {featuredProjects.length > 0 ? (
          <>
            <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {featuredProjects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>

            <div className="mt-8 sm:hidden">
              <Link href="/projects">
                <Button size="lg" variant="outline" className="w-full">
                  View All Projects
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </>
        ) : (
          <div className="mt-10 rounded-2xl border border-dashed border-border/60 bg-card/30 p-10 text-center">
            <p className="text-base text-muted-foreground">
              No published projects are featured yet. Add a few strong case
              studies in admin and mark them as published to bring the homepage
              to life.
            </p>
            <div className="mt-6">
              <Link href="/projects">
                <Button variant="outline">
                  Browse Projects
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
