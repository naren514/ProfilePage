"use client";

import { useState } from "react";
import { JobInput } from "@/components/fit-check/job-input";
import { ResultsDisplay, FitAssessmentResult } from "@/components/fit-check/results-display";
import { ChatWidget } from "@/components/chat/chat-widget";
import { toast } from "sonner";
import { Target, Sparkles, FileSearch } from "lucide-react";

export default function FitCheckPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<FitAssessmentResult | null>(null);

  const handleSubmit = async (jobDescription: string) => {
    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/fit-assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobDescription }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to analyze job fit");
      }

      const data = await response.json();
      setResult(data);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to analyze job fit"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="min-h-screen pt-24 pb-16">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          {/* Header */}
          <div className="mx-auto max-w-2xl text-center mb-12">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Target className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight mb-4">
              Fit Assessment Tool
            </h1>
            <p className="text-lg text-muted-foreground">
              Analyze how well the candidate&apos;s experience matches your job requirements.
              Paste a job description or provide a URL to get an instant assessment.
            </p>
          </div>

          {/* Features */}
          {!result && (
            <div className="grid gap-6 md:grid-cols-3 mb-12 max-w-4xl mx-auto">
              <div className="flex flex-col items-center text-center p-6 rounded-lg bg-card/30 border border-border/40">
                <FileSearch className="h-8 w-8 text-primary mb-3" />
                <h3 className="font-semibold mb-2">RAG-Powered Analysis</h3>
                <p className="text-sm text-muted-foreground">
                  Searches through resume, projects, and certifications to find relevant experience
                </p>
              </div>
              <div className="flex flex-col items-center text-center p-6 rounded-lg bg-card/30 border border-border/40">
                <Sparkles className="h-8 w-8 text-primary mb-3" />
                <h3 className="font-semibold mb-2">AI-Driven Insights</h3>
                <p className="text-sm text-muted-foreground">
                  Identifies matching skills, gaps, and transferable knowledge
                </p>
              </div>
              <div className="flex flex-col items-center text-center p-6 rounded-lg bg-card/30 border border-border/40">
                <Target className="h-8 w-8 text-primary mb-3" />
                <h3 className="font-semibold mb-2">Actionable Recommendations</h3>
                <p className="text-sm text-muted-foreground">
                  Get talking points and suggestions to address potential gaps
                </p>
              </div>
            </div>
          )}

          {/* Main Content */}
          <div className="max-w-4xl mx-auto">
            <div className="grid gap-8">
              <JobInput onSubmit={handleSubmit} isLoading={isLoading} />

              {result && <ResultsDisplay result={result} />}
            </div>
          </div>
        </div>
      </div>
      <ChatWidget />
    </>
  );
}
