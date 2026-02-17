import { Metadata } from "next";
import { unstable_noStore as noStore } from "next/cache";
import { db } from "@/lib/db";
import { volunteerWork } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Heart, Calendar, MapPin, Globe, ExternalLink } from "lucide-react";
import { ChatWidget } from "@/components/chat/chat-widget";

export const metadata: Metadata = {
  title: "Thoughts",
  description: "Community involvement and volunteer contributions.",
};

export const dynamic = "force-dynamic";

async function getVolunteerWork() {
  noStore();
  try {
    return await db
      .select()
      .from(volunteerWork)
      .where(eq(volunteerWork.isPublished, true))
      .orderBy(desc(volunteerWork.isCurrent), desc(volunteerWork.startDate));
  } catch {
    return [];
  }
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

export default async function VolunteerPage() {
  const volunteerList = await getVolunteerWork();

  return (
    <div className="pt-24 pb-16">
      <div className="mx-auto max-w-4xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Thoughts
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Giving back to the community through volunteer contributions
          </p>
        </div>

        {volunteerList.length > 0 ? (
          <div className="mt-16 space-y-8">
            {volunteerList.map((volunteer, index) => (
              <div key={volunteer.id} className="relative">
                {/* Timeline line */}
                {index < volunteerList.length - 1 && (
                  <div className="absolute left-6 top-16 bottom-0 w-px bg-border" />
                )}

                <Card className="bg-card/50 border-border/60">
                  <CardHeader>
                    <div className="flex items-start gap-4">
                      {/* Timeline dot */}
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary">
                        <Heart className="h-5 w-5" />
                      </div>

                      <div className="flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <CardTitle className="text-xl">{volunteer.role}</CardTitle>
                          {volunteer.isCurrent && (
                            <Badge variant="default" className="text-xs">
                              Current
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="text-lg text-foreground">{volunteer.organization}</p>
                          {volunteer.websiteUrl && (
                            <a
                              href={volunteer.websiteUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                          {volunteer.startDate && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {formatDate(volunteer.startDate)}
                              {" - "}
                              {volunteer.isCurrent
                                ? "Present"
                                : volunteer.endDate
                                ? formatDate(volunteer.endDate)
                                : ""}
                            </span>
                          )}
                          {volunteer.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-4 w-4" />
                              {volunteer.location}
                            </span>
                          )}
                          {volunteer.cause && (
                            <span className="flex items-center gap-1">
                              <Globe className="h-4 w-4" />
                              {volunteer.cause}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="ml-16 space-y-4">
                    {volunteer.description && (
                      <p className="text-muted-foreground">{volunteer.description}</p>
                    )}

                    {(volunteer.situation ||
                      volunteer.task ||
                      volunteer.action ||
                      volunteer.result) && (
                      <div className="space-y-4 pt-4 border-t border-border/40">
                        {volunteer.situation && (
                          <div>
                            <p className="text-sm font-medium mb-1">Situation</p>
                            <p className="text-sm text-muted-foreground">
                              {volunteer.situation}
                            </p>
                          </div>
                        )}
                        {volunteer.task && (
                          <div>
                            <p className="text-sm font-medium mb-1">Task</p>
                            <p className="text-sm text-muted-foreground">
                              {volunteer.task}
                            </p>
                          </div>
                        )}
                        {volunteer.action && (
                          <div>
                            <p className="text-sm font-medium mb-1">Action</p>
                            <p className="text-sm text-muted-foreground">
                              {volunteer.action}
                            </p>
                          </div>
                        )}
                        {volunteer.result && (
                          <div>
                            <p className="text-sm font-medium mb-1">Result</p>
                            <p className="text-sm text-muted-foreground">
                              {volunteer.result}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {volunteer.skills && volunteer.skills.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-2">
                        {volunteer.skills.map((skill) => (
                          <Badge key={skill} variant="secondary" className="text-xs">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-16 text-center">
            <p className="text-muted-foreground">
              Thoughts will be added soon. Check back later!
            </p>
          </div>
        )}
      </div>
      <ChatWidget />
    </div>
  );
}
