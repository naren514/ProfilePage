import { Metadata } from "next";
import { unstable_noStore as noStore } from "next/cache";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { ProjectCard } from "@/components/projects/project-card";
import { ChatWidget } from "@/components/chat/chat-widget";
import { Container, EmptyState, PageHeader } from "@/components/site/ui";

export const metadata: Metadata = {
  title: "Projects",
  description: "Case studies in enterprise application architecture, supply chain platforms, and cloud-native integration.",
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
    <Container>
      <PageHeader
        eyebrow="Work"
        title="Case studies"
        description="Enterprise application architecture, supply chain platforms and cloud-native integration, from the business case to the measured outcome."
      />
      {projectList.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projectList.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      ) : (
        <EmptyState>Case studies are on their way.</EmptyState>
      )}
      <ChatWidget />
    </Container>
  );
}
