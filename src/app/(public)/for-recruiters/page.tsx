import Link from "next/link";
import { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Briefcase, Code2, FlaskConical } from "lucide-react";
import { getSiteSettings } from "@/lib/settings";
import { profileUrl } from "@/lib/utils";

export const metadata: Metadata = {
  title: "For Recruiters",
  description: "Quick assessment tools and key information for recruiters evaluating this candidate",
};

export const dynamic = "force-dynamic";

export default async function ForRecruitersPage() {
  const settings = await getSiteSettings();
  const keyStats =
    settings.hero?.stats?.filter((stat) => stat.label?.trim() || stat.value?.trim()) ?? [];
  const skillCategories = settings.skills ?? [];
  const email = settings.contact?.email?.trim();
  const linkedin = settings.contact?.linkedin?.trim();
  const linkedinUrl = linkedin ? profileUrl(linkedin, "https://linkedin.com/in/") : null;

  return (
    <>
      <div className="min-h-screen pt-24 pb-16">
        <div className="mx-auto max-w-6xl px-6 lg:px-8">
          {/* Hero Section */}
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">
              Recruiter Portal
            </Badge>
            <h1 className="text-4xl font-bold tracking-tight mb-4">
              Evaluating This Candidate?
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Quick access to key qualifications, project case studies, and work
              history to help you determine fit for your role.
            </p>
          </div>

          {/* Quick Stats */}
          {keyStats.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
              {keyStats.map((stat) => (
                <Card key={stat.label} className="bg-card/50 border-border/60 text-center">
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">{stat.value}</div>
                    <div className="text-sm text-muted-foreground">{stat.label}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Core Skills */}
          {skillCategories.length > 0 && (
            <Card className="bg-card/50 border-border/60 mb-12">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Code2 className="h-5 w-5 text-primary" />
                  Core Skills
                </CardTitle>
                <CardDescription>
                  Primary technical competencies
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {skillCategories.map((category) => (
                  <div key={category.name} className="space-y-3">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                      {category.name}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {category.skills.map((skill) => (
                        <Badge key={skill} variant="secondary">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Quick Links */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <Link href="/projects" className="block group">
              <Card className="bg-card/50 border-border/60 h-full transition-colors hover:border-primary/40">
                <CardContent className="pt-6">
                  <Briefcase className="h-8 w-8 mb-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  <h3 className="font-semibold mb-2">View Work</h3>
                  <p className="text-sm text-muted-foreground">
                    Detailed case studies of major projects
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/experience" className="block group">
              <Card className="bg-card/50 border-border/60 h-full transition-colors hover:border-primary/40">
                <CardContent className="pt-6">
                  <FileText className="h-8 w-8 mb-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  <h3 className="font-semibold mb-2">Work History</h3>
                  <p className="text-sm text-muted-foreground">
                    Complete timeline of professional experience
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/lab" className="block group">
              <Card className="bg-card/50 border-border/60 h-full transition-colors hover:border-primary/40">
                <CardContent className="pt-6">
                  <FlaskConical className="h-8 w-8 mb-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  <h3 className="font-semibold mb-2">Lab</h3>
                  <p className="text-sm text-muted-foreground">
                    Open-source tools for OTM, EDI, and supply chain teams
                  </p>
                </CardContent>
              </Card>
            </Link>
          </div>

          {/* Contact CTA */}
          {(email || linkedinUrl) && (
            <Card className="bg-card/50 border-border/60">
              <CardContent className="py-8 text-center">
                <h2 className="text-xl font-semibold mb-2">Ready to Connect?</h2>
                <p className="text-muted-foreground mb-6">
                  Have questions or want to discuss opportunities?
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  {email && (
                    <Button asChild variant="default">
                      <a href={`mailto:${email}`}>Send Email</a>
                    </Button>
                  )}
                  {linkedinUrl && (
                    <Button asChild variant="outline">
                      <a href={linkedinUrl} target="_blank" rel="noopener noreferrer">
                        LinkedIn Profile
                      </a>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
