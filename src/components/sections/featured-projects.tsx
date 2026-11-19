import { unstable_noStore as noStore } from "next/cache";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects, type Project } from "@/lib/db/schema";
import { ProjectCard } from "@/components/projects/project-card";
import { Container, EmptyState, SectionHeader } from "@/components/site/ui";

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

// Distinct companies across published projects, in display order
export async function getProjectCompanies(): Promise<string[]> {
  noStore();
  try {
    const rows = await db
      .select({ company: projects.company })
      .from(projects)
      .where(eq(projects.isPublished, true))
      .orderBy(desc(projects.isFeatured), desc(projects.sortOrder));
    const names = rows.map((row) => row.company?.trim()).filter(Boolean) as string[];
    return Array.from(new Set(names)).slice(0, 6);
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
    <section className="py-12 sm:py-16">
      <Container>
        <SectionHeader
          title="Selected work"
          description="Case studies in architecture and delivery, from the business problem to the measured outcome."
          href={featuredProjects.length > 0 ? "/projects" : undefined}
          linkLabel="All projects"
        />
        {featuredProjects.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {featuredProjects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        ) : (
          <EmptyState>Case studies are on their way.</EmptyState>
        )}
      </Container>
    </section>
  );
}
