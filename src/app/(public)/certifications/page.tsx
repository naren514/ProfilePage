import { Metadata } from "next";
import { unstable_noStore as noStore } from "next/cache";
import { db } from "@/lib/db";
import { certifications } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpen, Calendar, ExternalLink } from "lucide-react";
import Link from "next/link";
import { ChatWidget } from "@/components/chat/chat-widget";

export const metadata: Metadata = {
  title: "Reading List",
  description: "Interesting online articles and curated reading notes.",
};

// Ensure fresh data on each request
export const dynamic = "force-dynamic";

async function getCertifications() {
  noStore();
  try {
    return await db
      .select()
      .from(certifications)
      .where(eq(certifications.isPublished, true))
      .orderBy(desc(certifications.publishedDate));
  } catch (error) {
    console.error("Error fetching certifications:", error);
    return [];
  }
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}


export default async function CertificationsPage() {
  const certList = await getCertifications();

  return (
    <div className="pt-24 pb-16">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Reading List
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            A curated stream of articles worth sharing, with short notes and excerpts
          </p>
        </div>

        {certList.length > 0 ? (
          <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {certList.map((cert) => {
              return (
                <Card
                  key={cert.id}
                  className="bg-card/50 border-border/60"
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary">
                        <BookOpen className="h-6 w-6" />
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {cert.isPublished ? "Published" : "Draft"}
                      </Badge>
                    </div>
                    <CardTitle className="text-lg mt-4">{cert.articleTitle}</CardTitle>
                    <p className="text-sm text-muted-foreground">{cert.source}</p>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        Date: {formatDate(cert.publishedDate)}
                      </div>
                      {cert.excerpt && (
                        <p className="text-sm text-muted-foreground line-clamp-4">
                          {cert.excerpt}
                        </p>
                      )}
                    </div>

                    {cert.articleUrl && (
                      <Link href={cert.articleUrl} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm" className="w-full">
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Read Article
                        </Button>
                      </Link>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="mt-16 text-center">
            <p className="text-muted-foreground">
              Reading list entries will be added soon. Check back later!
            </p>
          </div>
        )}
      </div>
      <ChatWidget />
    </div>
  );
}
