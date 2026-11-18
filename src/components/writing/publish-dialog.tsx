"use client";

import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { publishProblems } from "@/lib/writing/publish-rules";
import type { LiveInfo } from "./client";

export function PublishDialog({
  open,
  onOpenChange,
  title,
  slug,
  excerpt,
  wordCount,
  bodyJson,
  live,
  onPublish,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  slug: string;
  excerpt: string;
  wordCount: number;
  bodyJson: unknown;
  live: LiveInfo | null;
  onPublish: (confirmSlugChange: boolean) => Promise<void>;
}) {
  const [confirmSlug, setConfirmSlug] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const problems = publishProblems({ title, slug: slug || null, excerpt, wordCount, bodyJson });
  const isUpdate = Boolean(live?.isPublished);
  const slugChanged = isUpdate && live!.slug !== slug;
  const blocked = problems.length > 0 || (slugChanged && !confirmSlug);

  const publish = async () => {
    setPublishing(true);
    try {
      await onPublish(slugChanged && confirmSlug);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setConfirmSlug(false);
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isUpdate ? "Update the live post?" : "Publish this post?"}</DialogTitle>
          <DialogDescription>
            {isUpdate
              ? "The live post will be replaced with this draft."
              : "It will appear on narenc.com/thoughts straight away."}
          </DialogDescription>
        </DialogHeader>

        <dl className="space-y-2 text-sm">
          <div>
            <dt className="text-muted-foreground">Title</dt>
            <dd className="font-medium">{title || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Address</dt>
            <dd className="font-mono text-xs">narenc.com/thoughts/{slug || "…"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Excerpt</dt>
            <dd>{excerpt || "—"}</dd>
          </div>
        </dl>

        {problems.length > 0 && (
          <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
            <p className="font-medium">Before publishing:</p>
            <ul className="mt-1 list-disc pl-5">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        )}

        {slugChanged && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
            <p className="flex items-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4" aria-hidden />
              The address is changing
            </p>
            <p className="mt-1 text-muted-foreground">
              From <span className="font-mono">/thoughts/{live!.slug}</span> to{" "}
              <span className="font-mono">/thoughts/{slug}</span>. Links people have already shared to the old address will
              stop working.
            </p>
            <label className="mt-2 flex items-center gap-2">
              <input type="checkbox" checked={confirmSlug} onChange={(e) => setConfirmSlug(e.target.checked)} />
              Change the address anyway
            </label>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={publish} disabled={blocked || publishing}>
            {publishing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isUpdate ? "Update live post" : "Publish"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
