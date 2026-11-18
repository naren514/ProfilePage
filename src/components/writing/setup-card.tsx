"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { studioFetch } from "./client";

/** Shown until the Writing Studio tables exist. */
export function SetupCard({ onReady }: { onReady: () => void }) {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setRunning(true);
    setError(null);
    try {
      await studioFetch("/setup", { method: "POST" });
      onReady();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Setup failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Set up the Writing Studio</CardTitle>
        <CardDescription>
          This creates or updates the Writing Studio&apos;s database tables (drafts, version history, writing styles and AI
          usage). Your existing posts aren&apos;t changed. Each one gets a draft copy in the Studio, and the live posts stay
          exactly as they are. It&apos;s safe to run again.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button onClick={run} disabled={running}>
          {running && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Set up now
        </Button>
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      </CardContent>
    </Card>
  );
}
