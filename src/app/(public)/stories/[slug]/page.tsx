import { Metadata } from "next";
import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { stories } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Calendar, User, ArrowLeft } from "lucide-react";
import { ChatWidget } from "@/components/chat/chat-widget";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface StoryPageProps {
  params: Promise<{ slug: string }>;
}

async function getStory(slug: string) {
  noStore();
  try {
    const results = await db
      .select()
      .from(stories)
      .where(and(eq(stories.slug, slug), eq(stories.isPublished, true)))
      .limit(1);
    return results[0] || null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: StoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const story = await getStory(slug);

  if (!story) {
    return {
      title: "Story Not Found",
    };
  }

  return {
    title: story.title,
    description: story.summary,
  };
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export default async function StoryPage({ params }: StoryPageProps) {
  const { slug } = await params;
  const story = await getStory(slug);

  if (!story) {
    notFound();
  }

  return (
    <div className="pt-24 pb-16">
      <div className="mx-auto max-w-4xl px-6 lg:px-8">
        {/* Back button */}
        <Link href="/stories">
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Stories
          </Button>
        </Link>

        <Card className="bg-card/50 border-border/60">
          <CardHeader className="space-y-4">
            <CardTitle className="text-3xl">{story.title}</CardTitle>

            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              {story.company && (
                <span className="flex items-center gap-1">
                  <Building2 className="h-4 w-4" />
                  {story.company}
                </span>
              )}
              {story.role && (
                <span className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  {story.role}
                </span>
              )}
              {story.date && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {formatDate(story.date)}
                </span>
              )}
            </div>

            {story.tags && story.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {story.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </CardHeader>

          <CardContent className="space-y-8">
            <p className="text-lg text-muted-foreground">{story.summary}</p>

            {(story.situation || story.task || story.action || story.result) && (
              <div className="space-y-6 pt-4 border-t border-border/40">
                {story.situation && (
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Situation</h3>
                    <p className="text-muted-foreground">{story.situation}</p>
                  </div>
                )}

                {story.task && (
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Task</h3>
                    <p className="text-muted-foreground">{story.task}</p>
                  </div>
                )}

                {story.action && (
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Action</h3>
                    <p className="text-muted-foreground">{story.action}</p>
                  </div>
                )}

                {story.result && (
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Result</h3>
                    <p className="text-muted-foreground">{story.result}</p>
                  </div>
                )}
              </div>
            )}

            {story.lessonsLearned && (
              <div className="pt-4 border-t border-border/40">
                <h3 className="text-lg font-semibold mb-2">Lessons Learned</h3>
                <p className="text-muted-foreground">{story.lessonsLearned}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <ChatWidget />
    </div>
  );
}
