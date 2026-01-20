"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2,
  XCircle,
  ArrowRight,
  Lightbulb,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export interface FitAssessmentResult {
  overallFitScore: number;
  matchingSkills: string[];
  gaps: string[];
  transferableSkills?: Array<{
    skill: string;
    relevance: string;
    confidence: number;
  }>;
  recommendations: string[];
  summary: string;
}

interface ResultsDisplayProps {
  result: FitAssessmentResult;
  onDownload?: () => void;
}

function getScoreColor(score: number): string {
  if (score >= 80) return "text-green-500";
  if (score >= 60) return "text-yellow-500";
  if (score >= 40) return "text-orange-500";
  return "text-red-500";
}

function getScoreLabel(score: number): string {
  if (score >= 80) return "Excellent Match";
  if (score >= 60) return "Good Match";
  if (score >= 40) return "Partial Match";
  return "Limited Match";
}

function getProgressColor(score: number): string {
  if (score >= 80) return "bg-green-500";
  if (score >= 60) return "bg-yellow-500";
  if (score >= 40) return "bg-orange-500";
  return "bg-red-500";
}

export function ResultsDisplay({ result, onDownload }: ResultsDisplayProps) {
  const handleDownload = () => {
    const report = generateReport(result);
    const blob = new Blob([report], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fit-assessment-${new Date().toISOString().split("T")[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onDownload?.();
  };

  return (
    <div className="space-y-6">
      {/* Score Card */}
      <Card className="bg-card/50 border-border/60">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Fit Assessment</CardTitle>
              <CardDescription>{result.summary}</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" />
              Download Report
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="flex-shrink-0 text-center">
              <div
                className={`text-5xl font-bold ${getScoreColor(
                  result.overallFitScore
                )}`}
              >
                {result.overallFitScore}%
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {getScoreLabel(result.overallFitScore)}
              </p>
            </div>
            <div className="flex-1">
              <Progress
                value={result.overallFitScore}
                className={`h-3 ${getProgressColor(result.overallFitScore)}`}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Three Column Analysis */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Matching Skills */}
        <Card className="bg-card/50 border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Matching Skills
            </CardTitle>
            <CardDescription>
              Direct matches with job requirements
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {result.matchingSkills.map((skill, index) => (
                <Badge
                  key={index}
                  variant="outline"
                  className="border-green-500/50 text-green-600 bg-green-500/10"
                >
                  {skill}
                </Badge>
              ))}
              {result.matchingSkills.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No direct matches found
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Gaps */}
        <Card className="bg-card/50 border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <XCircle className="h-5 w-5 text-red-500" />
              Skill Gaps
            </CardTitle>
            <CardDescription>
              Required skills not directly demonstrated
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {result.gaps.map((gap, index) => (
                <Badge
                  key={index}
                  variant="outline"
                  className="border-red-500/50 text-red-600 bg-red-500/10"
                >
                  {gap}
                </Badge>
              ))}
              {result.gaps.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No significant gaps identified
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Transferable Skills */}
        <Card className="bg-card/50 border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ArrowRight className="h-5 w-5 text-yellow-500" />
              Transferable Skills
            </CardTitle>
            <CardDescription>
              Related experience that could bridge gaps
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {result.transferableSkills && result.transferableSkills.length > 0 ? (
                result.transferableSkills.map((item, index) => (
                  <div key={index} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Badge
                        variant="outline"
                        className="border-yellow-500/50 text-yellow-600 bg-yellow-500/10"
                      >
                        {item.skill}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {Math.round(item.confidence * 100)}% relevant
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground pl-2">
                      {item.relevance}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No transferable skills identified
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recommendations */}
      <Card className="bg-card/50 border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-blue-500" />
            Recommendations
          </CardTitle>
          <CardDescription>
            Suggested talking points and ways to address gaps
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {result.recommendations.map((rec, index) => (
              <li key={index} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center text-sm font-medium">
                  {index + 1}
                </span>
                <span className="text-sm">{rec}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function generateReport(result: FitAssessmentResult): string {
  const date = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `# Fit Assessment Report
Generated: ${date}

## Overall Fit Score: ${result.overallFitScore}%
**Assessment:** ${getScoreLabel(result.overallFitScore)}

### Summary
${result.summary}

---

## Matching Skills (${result.matchingSkills.length})
${result.matchingSkills.map((s) => `- ${s}`).join("\n") || "No direct matches found"}

## Skill Gaps (${result.gaps.length})
${result.gaps.map((g) => `- ${g}`).join("\n") || "No significant gaps identified"}

## Transferable Skills
${
  result.transferableSkills && result.transferableSkills.length > 0
    ? result.transferableSkills
        .map(
          (t) => `- **${t.skill}** (${Math.round(t.confidence * 100)}% relevant)\n  ${t.relevance}`
        )
        .join("\n")
    : "No transferable skills identified"
}

---

## Recommendations
${result.recommendations.map((r, i) => `${i + 1}. ${r}`).join("\n")}

---
*Generated by Bharadwaz Kari's Portfolio - bharadwazkari.com*
`;
}
