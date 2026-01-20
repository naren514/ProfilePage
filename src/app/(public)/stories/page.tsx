import { Metadata } from "next";
import { unstable_noStore as noStore } from "next/cache";
import { db } from "@/lib/db";
import { stories } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Calendar, Building2, Star } from "lucide-react";
import { ChatWidget } from "@/components/chat/chat-widget";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Stories",
  description: "Professional stories and experiences from my career journey.",
};

export const dynamic = "force-dynamic";

async function getStories() {
  noStore();
  try {
    return await db
      .select()
      .from(stories)
      .where(eq(stories.isPublished, true))
      .orderBy(desc(stories.isFeatured), desc(stories.date));
  } catch {
    return [];
  }
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export default async function StoriesPage() {
  const storyList = await getStories();

  return (
    <div className="pt-24 pb-16">
      <div className="mx-auto max-w-4xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Stories
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Professional experiences and lessons learned throughout my career
          </p>
        </div>

        {storyList.length > 0 ? (
          <div className="mt-16 space-y-8">
            {storyList.map((story) => (
              <Link key={story.id} href={`/stories/${story.slug}`}>
                <Card className="bg-card/50 border-border/60 hover:bg-card/70 transition-colors cursor-pointer">
                  <CardHeader>
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary">
                        <BookOpen className="h-5 w-5" />
                      </div>

                      <div className="flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <CardTitle className="text-xl">{story.title}</CardTitle>
                          {story.isFeatured && (
                            <Badge variant="default" className="text-xs">
                              <Star className="h-3 w-3 mr-1" />
                              Featured
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                          {story.company && (
                            <span className="flex items-center gap-1">
                              <Building2 className="h-4 w-4" />
                              {story.company}
                            </span>
                          )}
                          {story.date && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {formatDate(story.date)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="ml-16 space-y-4">
                    <p className="text-muted-foreground">{story.summary}</p>

                    {story.tags && story.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-2">
                        {story.tags.map((tag) => (
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
              Stories will be added soon. Check back later!
            </p>
          </div>
        )}
      </div>
      <ChatWidget />
    </div>
  );
}
