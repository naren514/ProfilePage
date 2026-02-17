import Link from "next/link";
import { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChatWidget } from "@/components/chat/chat-widget";
import {
  MessageSquare,
  FileText,
  Award,
  CheckCircle2,
  Briefcase,
  Clock,
  Code2,
  Cloud,
} from "lucide-react";

export const metadata: Metadata = {
  title: "For Recruiters",
  description: "Quick assessment tools and key information for recruiters evaluating this candidate",
};

// These are sample values - actual data is loaded from the database via Admin settings
const keyStats = [
  { label: "Years Experience", value: "10+", icon: Clock },
  { label: "Projects Completed", value: "50+", icon: Award },
  { label: "Team Members Led", value: "15+", icon: Briefcase },
  { label: "Technologies", value: "20+", icon: Cloud },
];

const coreSkills = [
  "JavaScript",
  "TypeScript",
  "React",
  "Node.js",
  "Python",
  "AWS",
  "Docker",
  "PostgreSQL",
  "GraphQL",
  "CI/CD",
  "Agile",
  "Technical Leadership",
];

const highlights = [
  "Configure your highlights in the Admin Dashboard",
  "Add your key achievements and accomplishments",
  "Showcase metrics and impact from your work",
  "Highlight certifications and awards",
  "Include notable projects and contributions",
  "Update this content via Settings > Hero section",
];

export default function ForRecruitersPage() {
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
              Quick access to assessment tools, key qualifications, and AI-powered
              insights to help you determine fit for your role.
            </p>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
            {keyStats.map((stat) => (
              <Card key={stat.label} className="bg-card/50 border-border/60 text-center">
                <CardContent className="pt-6">
                  <stat.icon className="h-8 w-8 mx-auto mb-2 text-primary" />
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Two Column Layout */}
          <div className="grid md:grid-cols-2 gap-8 mb-12">
            {/* Core Skills */}
            <Card className="bg-card/50 border-border/60">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Code2 className="h-5 w-5 text-primary" />
                  Core Skills
                </CardTitle>
                <CardDescription>
                  Primary technical competencies
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {coreSkills.map((skill) => (
                    <Badge key={skill} variant="secondary">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Key Highlights */}
            <Card className="bg-card/50 border-border/60">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  Key Highlights
                </CardTitle>
                <CardDescription>
                  Notable achievements and impact
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {highlights.map((highlight, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <CheckCircle2 className="h-4 w-4 mt-1 text-green-500 flex-shrink-0" />
                      <span className="text-sm">{highlight}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Quick Links */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <Link href="/projects" className="block group">
              <Card className="bg-card/50 border-border/60 h-full transition-colors hover:border-primary/40">
                <CardContent className="pt-6">
                  <Briefcase className="h-8 w-8 mb-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  <h3 className="font-semibold mb-2">View Projects</h3>
                  <p className="text-sm text-muted-foreground">
                    Detailed STAR-format case studies of major projects
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

            <Link href="/chat" className="block group">
              <Card className="bg-card/50 border-border/60 h-full transition-colors hover:border-primary/40">
                <CardContent className="pt-6">
                  <MessageSquare className="h-8 w-8 mb-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  <h3 className="font-semibold mb-2">Ask AI Assistant</h3>
                  <p className="text-sm text-muted-foreground">
                    Get instant answers about qualifications and experience
                  </p>
                </CardContent>
              </Card>
            </Link>
          </div>

          {/* Contact CTA */}
          <Card className="bg-card/50 border-border/60">
            <CardContent className="py-8 text-center">
              <h2 className="text-xl font-semibold mb-2">Ready to Connect?</h2>
              <p className="text-muted-foreground mb-6">
                Have questions or want to discuss opportunities?
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button asChild variant="default">
                  <a href="mailto:your.email@example.com">
                    Send Email
                  </a>
                </Button>
                <Button asChild variant="outline">
                  <a href="https://linkedin.com/in/yourprofile" target="_blank" rel="noopener noreferrer">
                    LinkedIn Profile
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <ChatWidget />
    </>
  );
}
