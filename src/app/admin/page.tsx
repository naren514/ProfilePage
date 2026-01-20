import { Metadata } from "next";
import { db } from "@/lib/db";
import { documents, projects, experiences, chatSessions, tokenUsage } from "@/lib/db/schema";
import { count, sql, desc } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Briefcase, Building2, MessageSquare, Cpu, Users } from "lucide-react";

export const metadata: Metadata = {
  title: "Admin Dashboard",
};

async function getStats() {
  try {
    const [
      docCount,
      projectCount,
      expCount,
      sessionCount,
      tokenStats,
    ] = await Promise.all([
      db.select({ count: count() }).from(documents),
      db.select({ count: count() }).from(projects),
      db.select({ count: count() }).from(experiences),
      db.select({ count: count() }).from(chatSessions),
      db
        .select({
          totalPromptTokens: sql<number>`COALESCE(SUM(${tokenUsage.promptTokens}), 0)`,
          totalCompletionTokens: sql<number>`COALESCE(SUM(${tokenUsage.completionTokens}), 0)`,
        })
        .from(tokenUsage),
    ]);

    return {
      documents: docCount[0]?.count || 0,
      projects: projectCount[0]?.count || 0,
      experiences: expCount[0]?.count || 0,
      chatSessions: sessionCount[0]?.count || 0,
      totalTokens: (tokenStats[0]?.totalPromptTokens || 0) + (tokenStats[0]?.totalCompletionTokens || 0),
    };
  } catch {
    return {
      documents: 0,
      projects: 0,
      experiences: 0,
      chatSessions: 0,
      totalTokens: 0,
    };
  }
}

async function getRecentSessions() {
  try {
    return await db
      .select()
      .from(chatSessions)
      .orderBy(desc(chatSessions.createdAt))
      .limit(5);
  } catch {
    return [];
  }
}

export default async function AdminDashboard() {
  const stats = await getStats();
  const recentSessions = await getRecentSessions();

  const statCards = [
    {
      title: "Documents",
      value: stats.documents,
      description: "Uploaded files",
      icon: FileText,
    },
    {
      title: "Projects",
      value: stats.projects,
      description: "Portfolio projects",
      icon: Briefcase,
    },
    {
      title: "Experience",
      value: stats.experiences,
      description: "Work entries",
      icon: Building2,
    },
    {
      title: "Chat Sessions",
      value: stats.chatSessions,
      description: "Visitor conversations",
      icon: MessageSquare,
    },
    {
      title: "Tokens Used",
      value: stats.totalTokens.toLocaleString(),
      description: "Total AI tokens",
      icon: Cpu,
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your portfolio and AI chat system
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {statCards.map((stat) => (
          <Card key={stat.title} className="bg-card/50 border-border/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-card/50 border-border/60">
          <CardHeader>
            <CardTitle>Recent Chat Sessions</CardTitle>
            <CardDescription>Latest visitor conversations</CardDescription>
          </CardHeader>
          <CardContent>
            {recentSessions.length > 0 ? (
              <div className="space-y-4">
                {recentSessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary">
                        <Users className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {session.totalMessages || 0} messages
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(session.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {session.totalTokens?.toLocaleString() || 0} tokens
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No chat sessions yet
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/60">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common administrative tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              <a
                href="/admin/documents"
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary/50 transition-colors"
              >
                <FileText className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Upload Documents</p>
                  <p className="text-xs text-muted-foreground">
                    Add new documents to the RAG system
                  </p>
                </div>
              </a>
              <a
                href="/admin/projects"
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary/50 transition-colors"
              >
                <Briefcase className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Add Project</p>
                  <p className="text-xs text-muted-foreground">
                    Create a new portfolio project
                  </p>
                </div>
              </a>
              <a
                href="/admin/experience"
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary/50 transition-colors"
              >
                <Building2 className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Add Experience</p>
                  <p className="text-xs text-muted-foreground">
                    Add work experience entry
                  </p>
                </div>
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
