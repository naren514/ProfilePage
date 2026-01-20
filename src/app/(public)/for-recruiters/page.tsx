import Link from "next/link";
import { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChatWidget } from "@/components/chat/chat-widget";
import {
  Target,
  MessageSquare,
  FileText,
  Award,
  CheckCircle2,
  ArrowRight,
  Briefcase,
  Clock,
  Code2,
  Cloud,
} from "lucide-react";

export const metadata: Metadata = {
  title: "For Recruiters",
  description: "Quick assessment tools and key information for recruiters evaluating Bharadwaz Kari",
};

const keyStats = [
  { label: "Years Experience", value: "15+", icon: Clock },
  { label: "Customer Satisfaction", value: "98%", icon: Award },
  { label: "TAMs Mentored", value: "12+", icon: Briefcase },
  { label: "Cloud Platforms", value: "AWS, Azure, GCP", icon: Cloud },
];

const coreSkills = [
  "AWS",
  "Cloud Security",
  "Generative AI",
  "Agentic AI",
  "Well-Architected Reviews",
  "Python",
  "Java",
  "JavaScript",
  "Project Management",
  "Agile",
  "CRM/ERP",
  "Technical Account Management",
];

const highlights = [
  "98% CSAT and eliminated 120+ hours of annual downtime through cloud optimizations",
  "Developed secure GenAI application increasing productivity by 50% for 100+ practitioners",
  "Mentored 12 Technical Account Managers, reducing ramp-up time by ~2 weeks",
  "Gold status in AWS Security community, fulfilling 40+ specialist requests in 9 months",
  "Created gamified incident-response exercises at AWS re:Invent, generating 350+ leads",
  "Spearheaded transition from Oracle CRM to Microsoft Dynamics, saving $80,000",
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
              Evaluating Bharadwaz Kari?
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

          {/* Main CTA - Fit Assessment */}
          <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20 mb-12">
            <CardContent className="py-8">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-primary/10">
                    <Target className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">Fit Assessment Tool</h2>
                    <p className="text-muted-foreground">
                      Paste your job description for an instant AI-powered fit analysis
                    </p>
                  </div>
                </div>
                <Button asChild size="lg">
                  <Link href="/fit-check">
                    Analyze Job Fit
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

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
                  <a href="mailto:bharadwaz.kari@gmail.com">
                    Send Email
                  </a>
                </Button>
                <Button asChild variant="outline">
                  <a href="https://linkedin.com/in/bharadwazkari" target="_blank" rel="noopener noreferrer">
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
