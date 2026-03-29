import { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { projects, experiences, stories, certifications } from "@/lib/db/schema";
import { count } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase, Building2, BookOpen, Award, Settings } from "lucide-react";

export const metadata: Metadata = {
  title: "Admin Dashboard",
};

async function getStats() {
  try {
    const [projectCount, expCount, storyCount, readingCount] = await Promise.all([
      db.select({ count: count() }).from(projects),
      db.select({ count: count() }).from(experiences),
      db.select({ count: count() }).from(stories),
      db.select({ count: count() }).from(certifications),
    ]);

    return {
      projects: projectCount[0]?.count || 0,
      experiences: expCount[0]?.count || 0,
      stories: storyCount[0]?.count || 0,
      readingList: readingCount[0]?.count || 0,
    };
  } catch {
    return {
      projects: 0,
      experiences: 0,
      stories: 0,
      readingList: 0,
    };
  }
}

export default async function AdminDashboard() {
  const stats = await getStats();

  const statCards = [
    {
      title: "Work",
      value: stats.projects,
      description: "Portfolio projects",
      icon: Briefcase,
    },
    {
      title: "Experience",
      value: stats.experiences,
      description: "Career entries",
      icon: Building2,
    },
    {
      title: "Thoughts",
      value: stats.stories,
      description: "Published stories",
      icon: BookOpen,
    },
    {
      title: "Reading List",
      value: stats.readingList,
      description: "Curated items",
      icon: Award,
    },
  ];

  const quickActions = [
    {
      href: "/admin/settings",
      title: "Polish profile basics",
      description: "Update hero, headline, and other core site settings.",
      icon: Settings,
    },
    {
      href: "/admin/projects",
      title: "Add featured work",
      description: "Create or publish projects that should appear on the homepage.",
      icon: Briefcase,
    },
    {
      href: "/admin/experience",
      title: "Add experience",
      description: "Fill in the career timeline behind the portfolio.",
      icon: Building2,
    },
    {
      href: "/admin/stories",
      title: "Write a thought piece",
      description: "Add a story or article to deepen the portfolio narrative.",
      icon: BookOpen,
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          A simpler control panel for managing the portfolio itself.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title} className="border-border/60 bg-card/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card className="border-border/60 bg-card/50">
          <CardHeader>
            <CardTitle>Recommended flow</CardTitle>
            <CardDescription>
              The shortest path to making the public site feel complete.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-4 text-sm">
              <li>
                <span className="font-medium">1. Update Settings</span>
                <p className="mt-1 text-muted-foreground">
                  Tighten the hero copy, subtitle, and core positioning.
                </p>
              </li>
              <li>
                <span className="font-medium">2. Add Work</span>
                <p className="mt-1 text-muted-foreground">
                  Publish 2–3 strong projects so the homepage Featured Projects section comes alive.
                </p>
              </li>
              <li>
                <span className="font-medium">3. Add Experience</span>
                <p className="mt-1 text-muted-foreground">
                  Fill in the professional timeline so the rest of the site feels grounded.
                </p>
              </li>
              <li>
                <span className="font-medium">4. Add Thoughts / Reading List</span>
                <p className="mt-1 text-muted-foreground">
                  Optional, but useful for depth once the core portfolio is in place.
                </p>
              </li>
            </ol>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/50">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Jump straight to the important sections.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {quickActions.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-secondary/50"
                >
                  <action.icon className="mt-0.5 h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{action.title}</p>
                    <p className="text-xs text-muted-foreground">{action.description}</p>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
