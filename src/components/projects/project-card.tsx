"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Building2 } from "lucide-react";
import { type Project } from "@/lib/db/schema";

interface ProjectCardProps {
  project: Project;
}

export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <Link href={`/projects/${project.slug}`}>
      <Card className="h-full bg-card/50 border-border/60 transition-all hover:border-border hover:bg-card/80">
        <CardHeader>
          {project.isFeatured && (
            <Badge variant="secondary" className="w-fit mb-2">
              Featured
            </Badge>
          )}
          <CardTitle className="text-xl">{project.title}</CardTitle>
          {project.company && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Building2 className="h-4 w-4" />
              {project.company}
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground line-clamp-3">
            {project.summary}
          </p>

          <div className="flex flex-wrap gap-2">
            {project.technologies.slice(0, 5).map((tech) => (
              <Badge key={tech} variant="outline" className="text-xs">
                {tech}
              </Badge>
            ))}
            {project.technologies.length > 5 && (
              <Badge variant="outline" className="text-xs">
                +{project.technologies.length - 5} more
              </Badge>
            )}
          </div>

          <div className="flex items-center text-sm font-medium">
            View Details
            <ArrowRight className="ml-1 h-4 w-4" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
