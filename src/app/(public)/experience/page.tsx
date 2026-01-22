import { Metadata } from "next";
import { unstable_noStore as noStore } from "next/cache";
import { db } from "@/lib/db";
import { experiences } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Calendar, MapPin } from "lucide-react";
import { ChatWidget } from "@/components/chat/chat-widget";

export const metadata: Metadata = {
  title: "Experience",
  description: "Professional experience in technology, cloud architecture, and software development.",
};

export const dynamic = "force-dynamic";

async function getExperiences() {
  noStore();
  try {
    return await db
      .select()
      .from(experiences)
      .orderBy(desc(experiences.isCurrent), desc(experiences.startDate));
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

export default async function ExperiencePage() {
  const experienceList = await getExperiences();

  return (
    <div className="pt-24 pb-16">
      <div className="mx-auto max-w-4xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Experience
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            A timeline of professional experience and career journey
          </p>
        </div>

        {experienceList.length > 0 ? (
          <div className="mt-16 space-y-8">
            {experienceList.map((exp, index) => (
              <div key={exp.id} className="relative">
                {/* Timeline line */}
                {index < experienceList.length - 1 && (
                  <div className="absolute left-6 top-16 bottom-0 w-px bg-border" />
                )}

                <Card className="bg-card/50 border-border/60">
                  <CardHeader>
                    <div className="flex items-start gap-4">
                      {/* Timeline dot */}
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary">
                        <Building2 className="h-5 w-5" />
                      </div>

                      <div className="flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <CardTitle className="text-xl">{exp.title}</CardTitle>
                          {exp.isCurrent && (
                            <Badge variant="default" className="text-xs">
                              Current
                            </Badge>
                          )}
                        </div>
                        <p className="text-lg text-foreground">{exp.company}</p>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {formatDate(exp.startDate)}
                            {" - "}
                            {exp.isCurrent ? "Present" : exp.endDate ? formatDate(exp.endDate) : ""}
                          </span>
                          {exp.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-4 w-4" />
                              {exp.location}
                            </span>
                          )}
                          <Badge variant="outline" className="text-xs">
                            {exp.employmentType}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="ml-16 space-y-4">
                    {exp.description && (
                      <p className="text-muted-foreground">{exp.description}</p>
                    )}

                    {exp.achievements && exp.achievements.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">Key Achievements:</p>
                        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                          {exp.achievements.map((achievement, i) => (
                            <li key={i}>{achievement}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {exp.technologies && exp.technologies.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-2">
                        {exp.technologies.map((tech) => (
                          <Badge key={tech} variant="secondary" className="text-xs">
                            {tech}
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
              Experience timeline will be added soon. Check back later!
            </p>
          </div>
        )}
      </div>
      <ChatWidget />
    </div>
  );
}
