import { Metadata } from "next";
import { getSiteSettings, getLabSettings } from "@/lib/settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Github, ExternalLink, Globe } from "lucide-react";
import { ChatWidget } from "@/components/chat/chat-widget";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Lab",
  description:
    "Open-source tools built for Oracle Transportation Management, EDI, parcel shipping, and supply chain operations.",
};

export const dynamic = "force-dynamic";

export default async function LabPage() {
  const settings = await getSiteSettings();
  const labList = getLabSettings(settings);

  return (
    <div className="pt-24 pb-16">
      <div className="mx-auto max-w-5xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Lab</h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Open-source tools built for Oracle OTM, EDI, parcel shipping, and supply chain teams —
            scratching itches that commercial platforms don&apos;t.
          </p>
        </div>

        {labList.length > 0 ? (
          <div className="mt-16 grid gap-6 sm:grid-cols-2">
            {labList
              .sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99))
              .map((tool) => (
                <Card
                  key={tool.githubUrl}
                  className="bg-card/50 border-border/60 flex flex-col"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <CardTitle className="text-lg leading-snug">{tool.title}</CardTitle>
                      <div className="flex items-center gap-2 shrink-0">
                        {tool.liveUrl && (
                          <Link
                            href={tool.liveUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Globe className="h-4 w-4" />
                            <span className="sr-only">Live demo</span>
                          </Link>
                        )}
                        <Link
                          href={tool.githubUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Github className="h-5 w-5" />
                          <span className="sr-only">GitHub</span>
                        </Link>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="flex flex-col flex-1 gap-4">
                    <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                      {tool.description}
                    </p>

                    <div className="flex flex-wrap gap-1.5">
                      {tool.technologies.map((tech) => (
                        <Badge key={tech} variant="secondary" className="text-xs">
                          {tech}
                        </Badge>
                      ))}
                    </div>

                    <div className={`flex gap-2 mt-auto ${tool.liveUrl ? "flex-col sm:flex-row" : ""}`}>
                      {tool.liveUrl && (
                        <Button asChild variant="default" size="sm" className="flex-1">
                          <Link href={tool.liveUrl} target="_blank" rel="noopener noreferrer">
                            <Globe className="mr-2 h-3.5 w-3.5" />
                            Live Demo
                          </Link>
                        </Button>
                      )}
                      <Button
                        asChild
                        variant={tool.liveUrl ? "outline" : "outline"}
                        size="sm"
                        className="flex-1"
                      >
                        <Link href={tool.githubUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="mr-2 h-3.5 w-3.5" />
                          View on GitHub
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        ) : (
          <div className="mt-16 text-center">
            <p className="text-muted-foreground">No lab entries yet.</p>
          </div>
        )}
      </div>
      <ChatWidget />
    </div>
  );
}
