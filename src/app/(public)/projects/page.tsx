import { Metadata } from "next";
import { unstable_noStore as noStore } from "next/cache";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { ProjectCard } from "@/components/projects/project-card";
import { ChatWidget } from "@/components/chat/chat-widget";

export const metadata: Metadata = {
  title: "Work",
  description: "Featured projects showcasing cloud architecture, DevOps, and enterprise solutions.",
};

export const dynamic = "force-dynamic";

async function getProjects() {
  noStore();
  try {
    return await db
      .select()
      .from(projects)
      .where(eq(projects.isPublished, true))
      .orderBy(desc(projects.isFeatured), desc(projects.sortOrder));
  } catch {
    // Return empty array if database is not set up yet
    return [];
  }
}

export default async function ProjectsPage() {
  const projectList = await getProjects();

  return (
    <div className="pt-24 pb-16">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Work
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            A selection of projects demonstrating my expertise in cloud architecture,
            DevOps transformation, and enterprise solutions.
          </p>
        </div>

        {projectList.length > 0 ? (
          <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-8 md:grid-cols-2">
            {projectList.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        ) : (
          <div className="mt-16 text-center">
            <p className="text-muted-foreground">
              Work entries will be added soon. Check back later!
            </p>
          </div>
        )}
      </div>
      <ChatWidget />
    </div>
  );
}
