import Link from "next/link";
import { Metadata } from "next";
import { unstable_noStore as noStore } from "next/cache";
import { db } from "@/lib/db";
import { stories } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, ArrowRight } from "lucide-react";
import { ChatWidget } from "@/components/chat/chat-widget";

export const metadata: Metadata = {
  title: "Thoughts",
  description: "Personal writing, reflections, and ideas.",
};

export const dynamic = "force-dynamic";

async function getThoughts() {
  noStore();
  try {
    return await db
      .select()
      .from(stories)
      .where(eq(stories.isPublished, true))
      .orderBy(desc(stories.date), desc(stories.createdAt));
  } catch {
    return [];
  }
}

function formatDate(date: string | null) {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function ThoughtsPage() {
  const thoughtList = await getThoughts();

  return (
    <div className="pt-24 pb-16">
      <div className="mx-auto max-w-4xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-4xl font-bold tracking-tight">Thoughts</h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Notes on building, learning, and the occasional hard-won lesson.
          </p>
        </div>

        {thoughtList.length > 0 ? (
          <div className="mt-14 space-y-6">
            {thoughtList.map((story) => (
              <Link key={story.id} href={`/volunteer/${story.slug}`} className="block group">
                <Card className="bg-card/50 border-border/60 transition-colors hover:border-foreground/30">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2">
                        <CardTitle className="text-2xl leading-tight group-hover:underline underline-offset-4">
                          {story.title}
                        </CardTitle>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                          {story.date && (
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {formatDate(story.date)}
                            </span>
                          )}
                          {story.company && <span>· {story.company}</span>}
                        </div>
                      </div>
                      <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground line-clamp-3">{story.summary}</p>
                    {story.tags && story.tags.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {story.tags.slice(0, 5).map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-16 text-center">
            <p className="text-muted-foreground">
              No thoughts published yet. Add one in Admin → Thoughts.
            </p>
          </div>
        )}
      </div>
      <ChatWidget />
    </div>
  );
}
