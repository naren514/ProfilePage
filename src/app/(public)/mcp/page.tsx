import { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Bot,
  Search,
  Briefcase,
  Award,
  Wrench,
  User,
  FileText,
  Heart,
  Sparkles,
  CheckCircle,
  Code,
  ExternalLink,
} from "lucide-react";
import { ChatWidget } from "@/components/chat/chat-widget";

export const metadata: Metadata = {
  title: "MCP Server - AI Agent Access",
  description:
    "Model Context Protocol (MCP) server for AI agents to access Bharadwaz Kari's professional portfolio, skills, experiences, and certifications.",
  openGraph: {
    title: "Bharadwaz Kari - MCP Server for AI Agents",
    description: "Connect your AI agent to access professional portfolio data via Model Context Protocol",
  },
};

const tools = [
  {
    name: "get_profile_summary",
    description: "Get comprehensive profile summary including headline, stats, and key information",
    icon: User,
  },
  {
    name: "search_experiences",
    description: "Search and filter work experiences by company, role, or technology",
    icon: Briefcase,
  },
  {
    name: "get_skills",
    description: "Get technical and professional skills, optionally filtered by category",
    icon: Wrench,
  },
  {
    name: "get_certifications",
    description: "Get professional certifications (AWS, etc.) with credential details",
    icon: Award,
  },
  {
    name: "get_projects",
    description: "Get portfolio projects with STAR format details",
    icon: FileText,
  },
  {
    name: "assess_job_fit",
    description: "Analyze job fit with matching skills, gaps, and recommendations",
    icon: Sparkles,
  },
  {
    name: "get_stories",
    description: "Get professional stories and case studies in STAR format",
    icon: FileText,
  },
  {
    name: "get_volunteer_experience",
    description: "Get volunteer work and community contributions",
    icon: Heart,
  },
  {
    name: "semantic_search",
    description: "Natural language search using vector similarity across all portfolio content",
    icon: Search,
  },
];

const resources = [
  {
    uri: "portfolio://profile",
    title: "Professional Profile",
    description: "Complete resume summary and profile information",
  },
  {
    uri: "portfolio://skills",
    title: "Skills Matrix",
    description: "Skills organized by category with proficiency levels",
  },
  {
    uri: "portfolio://contact",
    title: "Contact Information",
    description: "Professional contact details and portfolio links",
  },
];

const prompts = [
  {
    name: "candidate-summary",
    description: "Generate a candidate summary for a specific role",
    args: ["targetRole"],
  },
  {
    name: "technical-deep-dive",
    description: "Deep dive into experience with a specific technology",
    args: ["technology"],
  },
];

export default function MCPPage() {
  return (
    <div className="pt-24 pb-16">
      <div className="mx-auto max-w-5xl px-6 lg:px-8">
        {/* Header */}
        <div className="mx-auto max-w-3xl text-center">
          <div className="flex justify-center mb-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
              <Bot className="h-8 w-8" />
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            MCP Server for AI Agents
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Connect your AI agent to access Bharadwaz Kari&apos;s professional portfolio using the{" "}
            <a
              href="https://modelcontextprotocol.io"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground underline hover:text-primary"
            >
              Model Context Protocol (MCP)
            </a>
          </p>
        </div>

        {/* Connection Info */}
        <Card className="mt-12 bg-card/50 border-border/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code className="h-5 w-5" />
              Quick Start
            </CardTitle>
            <CardDescription>
              Add this to your MCP client configuration to connect
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-secondary/50 rounded-lg p-4 font-mono text-sm overflow-x-auto">
              <pre>{`{
  "mcpServers": {
    "bharadwaz-portfolio": {
      "url": "https://bharadwazkari.com/api/mcp"
    }
  }
}`}</pre>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Or use with mcp-remote for stdio-based clients:
            </p>
            <div className="bg-secondary/50 rounded-lg p-4 font-mono text-sm overflow-x-auto mt-2">
              <pre>{`npx mcp-remote https://bharadwazkari.com/api/mcp`}</pre>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant="secondary">Streamable HTTP Transport</Badge>
              <Badge variant="secondary">MCP Protocol 2024-11-05</Badge>
              <Badge variant="secondary">No Authentication Required</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Available Tools */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold tracking-tight mb-6">Available Tools</h2>
          <p className="text-muted-foreground mb-6">
            These tools enable AI agents to query and interact with the portfolio data
          </p>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {tools.map((tool) => (
              <Card key={tool.name} className="bg-card/50 border-border/60">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <tool.icon className="h-4 w-4 text-muted-foreground" />
                    <code className="text-sm">{tool.name}</code>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{tool.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Resources */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold tracking-tight mb-6">Available Resources</h2>
          <p className="text-muted-foreground mb-6">
            Static resources AI agents can read for reference data
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            {resources.map((resource) => (
              <Card key={resource.uri} className="bg-card/50 border-border/60">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{resource.title}</CardTitle>
                  <code className="text-xs text-muted-foreground">{resource.uri}</code>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{resource.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Prompts */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold tracking-tight mb-6">Prompt Templates</h2>
          <p className="text-muted-foreground mb-6">
            Reusable prompt templates for common queries
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {prompts.map((prompt) => (
              <Card key={prompt.name} className="bg-card/50 border-border/60">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-muted-foreground" />
                    <code>{prompt.name}</code>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{prompt.description}</p>
                  <div className="mt-2 flex gap-2">
                    {prompt.args.map((arg) => (
                      <Badge key={arg} variant="outline" className="text-xs">
                        {arg}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Use Cases */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold tracking-tight mb-6">Example Use Cases</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="bg-secondary/30 border-border/40">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium">Recruiter AI Assistants</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      AI agents can assess job fit, match skills to requirements, and generate candidate summaries
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-secondary/30 border-border/40">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium">Technical Screening</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Validate technical experience with specific technologies using semantic search
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-secondary/30 border-border/40">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium">Portfolio Research</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Deep dive into projects, experiences, and professional stories
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-secondary/30 border-border/40">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium">Interview Preparation</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Generate relevant questions based on experience and skills
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Links */}
        <div className="mt-12 text-center">
          <p className="text-muted-foreground mb-4">
            Learn more about the Model Context Protocol
          </p>
          <div className="flex justify-center gap-4">
            <a
              href="https://modelcontextprotocol.io"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-foreground hover:text-primary transition-colors"
            >
              MCP Documentation
              <ExternalLink className="h-3 w-3" />
            </a>
            <a
              href="https://github.com/modelcontextprotocol/typescript-sdk"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-foreground hover:text-primary transition-colors"
            >
              TypeScript SDK
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>
      <ChatWidget />
    </div>
  );
}
