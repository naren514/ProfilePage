"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Link2, FileText, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface JobInputProps {
  onSubmit: (jobDescription: string) => void;
  isLoading: boolean;
}

export function JobInput({ onSubmit, isLoading }: JobInputProps) {
  const [jobDescription, setJobDescription] = useState("");
  const [jobUrl, setJobUrl] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (jobDescription.trim().length >= 50) {
      onSubmit(jobDescription);
    }
  };

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUrlError(null);

    if (!jobUrl.trim()) {
      setUrlError("Please enter a job URL");
      return;
    }

    setIsFetchingUrl(true);

    try {
      const response = await fetch("/api/scrape-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: jobUrl }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch job posting");
      }

      const data = await response.json();
      setJobDescription(data.content);
      onSubmit(data.content);
    } catch (error) {
      setUrlError(error instanceof Error ? error.message : "Failed to fetch job posting");
    } finally {
      setIsFetchingUrl(false);
    }
  };

  return (
    <Card className="bg-card/50 border-border/60">
      <CardHeader>
        <CardTitle>Job Description</CardTitle>
        <CardDescription>
          Paste a job description or provide a URL to analyze fit
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="text" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="text" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Paste Text
            </TabsTrigger>
            <TabsTrigger value="url" className="flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              Job URL
            </TabsTrigger>
          </TabsList>

          <TabsContent value="text">
            <form onSubmit={handleTextSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="job-description">
                  Job Description (minimum 50 characters)
                </Label>
                <Textarea
                  id="job-description"
                  placeholder="Paste the job description here..."
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  rows={12}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground text-right">
                  {jobDescription.length} characters
                </p>
              </div>
              <Button
                type="submit"
                disabled={isLoading || jobDescription.trim().length < 50}
                className="w-full"
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Analyze Fit
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="url">
            <form onSubmit={handleUrlSubmit} className="space-y-4">
              {urlError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{urlError}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="job-url">Job Posting URL</Label>
                <Input
                  id="job-url"
                  type="url"
                  placeholder="https://linkedin.com/jobs/view/..."
                  value={jobUrl}
                  onChange={(e) => setJobUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Supports LinkedIn, Indeed, Greenhouse, Lever, and most job boards
                </p>
              </div>
              <Button
                type="submit"
                disabled={isFetchingUrl || isLoading || !jobUrl.trim()}
                className="w-full"
              >
                {(isFetchingUrl || isLoading) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isFetchingUrl ? "Fetching..." : "Analyze Fit"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
