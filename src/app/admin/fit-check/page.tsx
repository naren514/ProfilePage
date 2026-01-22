"use client";

import { useState } from "react";
import { JobInput } from "@/components/fit-check/job-input";
import { ResultsDisplay, FitAssessmentResult } from "@/components/fit-check/results-display";
import { toast } from "sonner";
import { Target } from "lucide-react";

export default function AdminFitCheckPage() {
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
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <Target className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Fit Assessment</h1>
        </div>
        <p className="text-muted-foreground">
          Analyze how well your experience matches a job description. Includes full recommendations for interview preparation.
        </p>
      </div>

      {/* Main Content */}
      <div className="grid gap-8">
        <JobInput onSubmit={handleSubmit} isLoading={isLoading} />

        {result && <ResultsDisplay result={result} showRecommendations={true} />}
      </div>
    </div>
  );
}
