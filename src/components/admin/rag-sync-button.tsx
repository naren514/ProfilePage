"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCw, Loader2, CheckCircle } from "lucide-react";
import { toast } from "sonner";

interface SyncStats {
  projects: number;
  experiences: number;
  certifications: number;
  skills: number;
  stories: number;
  volunteer: number;
  summary: number;
}

export function RAGSyncButton() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastStats, setLastStats] = useState<SyncStats | null>(null);

  const handleSync = async () => {
    setIsSyncing(true);
    setLastStats(null);

    try {
      const response = await fetch("/api/admin/rag-sync", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Sync failed");
      }

      const data = await response.json();
      setLastStats(data.stats);
      toast.success("RAG index rebuilt successfully");
    } catch (error) {
      console.error("Sync error:", error);
      toast.error("Failed to sync RAG index");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Card className="bg-card/50 border-border/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          RAG Index Sync
        </CardTitle>
        <CardDescription>
          Rebuild the RAG index from the current database. Use this if the chat shows outdated or conflicting information.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={handleSync} disabled={isSyncing} variant="outline">
          {isSyncing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Rebuilding Index...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Rebuild RAG Index
            </>
          )}
        </Button>

        {lastStats && (
          <div className="mt-4 p-4 bg-secondary/30 rounded-lg">
            <div className="flex items-center gap-2 text-sm font-medium mb-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Sync Complete
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm text-muted-foreground">
              <div>Projects: {lastStats.projects}</div>
              <div>Experience: {lastStats.experiences}</div>
              <div>Certifications: {lastStats.certifications}</div>
              <div>Skills: {lastStats.skills}</div>
              <div>Stories: {lastStats.stories}</div>
              <div>Volunteer: {lastStats.volunteer}</div>
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          This clears all existing RAG chunks and rebuilds them from the current database state.
        </p>
      </CardContent>
    </Card>
  );
}
