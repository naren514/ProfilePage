import type { MetadataRoute } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { certifications, projects, stories } from "@/lib/db/schema";

// Projects and posts are published from the admin panel, so build this per request
export const dynamic = "force-dynamic";

const SITE_URL = "https://narenc.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [projectList, thoughtList, readingList] = await Promise.all([
    db
      .select({ slug: projects.slug, updatedAt: projects.updatedAt })
      .from(projects)
      .where(eq(projects.isPublished, true))
      .catch(() => []),
    db
      .select({ slug: stories.slug, updatedAt: stories.updatedAt })
      .from(stories)
      .where(eq(stories.isPublished, true))
      .catch(() => []),
    db
      .select({ id: certifications.id })
      .from(certifications)
      .where(eq(certifications.isPublished, true))
      .limit(1)
      .catch(() => []),
  ]);

  const pages: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE_URL}/projects`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_URL}/experience`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_URL}/lab`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/for-recruiters`, changeFrequency: "monthly", priority: 0.6 },
  ];

  // Leave the Thoughts and Reading List pages out while they are empty
  if (thoughtList.length > 0) {
    pages.push({ url: `${SITE_URL}/volunteer`, changeFrequency: "weekly", priority: 0.7 });
  }
  if (readingList.length > 0) {
    pages.push({ url: `${SITE_URL}/certifications`, changeFrequency: "weekly", priority: 0.5 });
  }

  return [
    ...pages,
    ...projectList.map((project) => ({
      url: `${SITE_URL}/projects/${project.slug}`,
      lastModified: project.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    ...thoughtList.map((thought) => ({
      url: `${SITE_URL}/volunteer/${thought.slug}`,
      lastModified: thought.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
