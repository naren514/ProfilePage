import { Metadata } from "next";
import { db } from "@/lib/db";
import { tokenUsage, chatSessions, visitors } from "@/lib/db/schema";
import { desc, sql, gte } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Cpu, MessageSquare, Users, TrendingUp } from "lucide-react";

export const metadata: Metadata = {
  title: "Analytics | Admin",
};

async function getAnalytics() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0];

  try {
    const [tokenStats, dailyTokens, sessionStats, visitorCount] = await Promise.all([
      // Total token usage
      db
        .select({
          totalPromptTokens: sql<number>`COALESCE(SUM(${tokenUsage.promptTokens}), 0)`,
          totalCompletionTokens: sql<number>`COALESCE(SUM(${tokenUsage.completionTokens}), 0)`,
          totalRequests: sql<number>`COALESCE(SUM(${tokenUsage.requestCount}), 0)`,
        })
        .from(tokenUsage),

      // Daily token usage (last 30 days)
      db
        .select({
          date: tokenUsage.date,
          promptTokens: sql<number>`SUM(${tokenUsage.promptTokens})`,
          completionTokens: sql<number>`SUM(${tokenUsage.completionTokens})`,
          requests: sql<number>`SUM(${tokenUsage.requestCount})`,
        })
        .from(tokenUsage)
        .where(gte(tokenUsage.date, thirtyDaysAgoStr))
        .groupBy(tokenUsage.date)
        .orderBy(desc(tokenUsage.date))
        .limit(30),

      // Chat sessions stats
      db
        .select({
          totalSessions: sql<number>`COUNT(*)`,
          totalMessages: sql<number>`COALESCE(SUM(${chatSessions.totalMessages}), 0)`,
          avgMessages: sql<number>`COALESCE(AVG(${chatSessions.totalMessages}), 0)`,
        })
        .from(chatSessions),

      // Unique visitors (last 30 days)
      db
        .select({
          count: sql<number>`COUNT(DISTINCT ${visitors.visitorId})`,
        })
        .from(visitors)
        .where(gte(visitors.visitedAt, thirtyDaysAgo)),
    ]);

    return {
      tokens: {
        prompt: tokenStats[0]?.totalPromptTokens || 0,
        completion: tokenStats[0]?.totalCompletionTokens || 0,
        total: (tokenStats[0]?.totalPromptTokens || 0) + (tokenStats[0]?.totalCompletionTokens || 0),
        requests: tokenStats[0]?.totalRequests || 0,
      },
      dailyTokens: dailyTokens.reverse(),
      sessions: {
        total: sessionStats[0]?.totalSessions || 0,
        messages: sessionStats[0]?.totalMessages || 0,
        avgMessages: Math.round(sessionStats[0]?.avgMessages || 0),
      },
      visitors: visitorCount[0]?.count || 0,
    };
  } catch {
    return {
      tokens: { prompt: 0, completion: 0, total: 0, requests: 0 },
      dailyTokens: [],
      sessions: { total: 0, messages: 0, avgMessages: 0 },
      visitors: 0,
    };
  }
}

export default async function AnalyticsPage() {
  const analytics = await getAnalytics();

  const stats = [
    {
      title: "Total Tokens",
      value: analytics.tokens.total.toLocaleString(),
      description: `${analytics.tokens.prompt.toLocaleString()} prompt + ${analytics.tokens.completion.toLocaleString()} completion`,
      icon: Cpu,
    },
    {
      title: "API Requests",
      value: analytics.tokens.requests.toLocaleString(),
      description: "Total AI API calls",
      icon: TrendingUp,
    },
    {
      title: "Chat Sessions",
      value: analytics.sessions.total.toLocaleString(),
      description: `${analytics.sessions.avgMessages} avg messages/session`,
      icon: MessageSquare,
    },
    {
      title: "Unique Visitors",
      value: analytics.visitors.toLocaleString(),
      description: "Last 30 days",
      icon: Users,
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">
          Monitor token usage and visitor analytics
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="bg-card/50 border-border/60">
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

      {/* Daily Usage */}
      <Card className="bg-card/50 border-border/60">
        <CardHeader>
          <CardTitle>Daily Token Usage</CardTitle>
          <CardDescription>Token consumption over the last 30 days</CardDescription>
        </CardHeader>
        <CardContent>
          {analytics.dailyTokens.length > 0 ? (
            <div className="space-y-4">
              {/* Simple bar chart representation */}
              <div className="space-y-2">
                {analytics.dailyTokens.slice(0, 14).map((day) => {
                  const total = day.promptTokens + day.completionTokens;
                  const maxTokens = Math.max(
                    ...analytics.dailyTokens.map((d) => d.promptTokens + d.completionTokens)
                  );
                  const percentage = maxTokens > 0 ? (total / maxTokens) * 100 : 0;

                  return (
                    <div key={day.date} className="flex items-center gap-4">
                      <span className="text-sm text-muted-foreground w-24">
                        {new Date(day.date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      <div className="flex-1 h-6 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-sm w-20 text-right">
                        {total.toLocaleString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No usage data available yet
            </p>
          )}
        </CardContent>
      </Card>

      {/* Cost Estimation */}
      <Card className="bg-card/50 border-border/60">
        <CardHeader>
          <CardTitle>Estimated Costs</CardTitle>
          <CardDescription>Based on Gemini API pricing</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Chat (Gemini Flash)</p>
              <p className="text-xl font-semibold">
                ${((analytics.tokens.prompt * 0.00001 + analytics.tokens.completion * 0.00004)).toFixed(4)}
              </p>
              <p className="text-xs text-muted-foreground">
                $0.01/1M input + $0.04/1M output
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Embeddings</p>
              <p className="text-xl font-semibold">
                ${(analytics.tokens.prompt * 0.000001).toFixed(4)}
              </p>
              <p className="text-xs text-muted-foreground">$0.001/1M tokens</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total Estimated</p>
              <p className="text-xl font-semibold">
                ${(
                  analytics.tokens.prompt * 0.00001 +
                  analytics.tokens.completion * 0.00004 +
                  analytics.tokens.prompt * 0.000001
                ).toFixed(4)}
              </p>
              <p className="text-xs text-muted-foreground">Combined API costs</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
