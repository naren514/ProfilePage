"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Sparkles, Loader2, Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface AIAssistDialogProps {
  targetField: "situation" | "task" | "action" | "result" | "lessonsLearned";
  currentValue: string;
  onApply: (content: string) => void;
}

const fieldLabels: Record<string, string> = {
  situation: "Situation",
  task: "Task",
  action: "Action",
  result: "Result",
  lessonsLearned: "Lessons Learned",
};

export function AIAssistDialog({
  targetField,
  currentValue,
  onApply,
}: AIAssistDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [rawNotes, setRawNotes] = useState(currentValue);
  const [generatedContent, setGeneratedContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!rawNotes.trim()) {
      toast.error("Please enter some notes to transform");
      return;
    }

    setIsLoading(true);
    setGeneratedContent("");

    try {
      const response = await fetch("/api/admin/ai-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawNotes, targetField }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate content");
      }

      const data = await response.json();
      setGeneratedContent(data.content);
    } catch {
      toast.error("Failed to generate content");
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = () => {
    onApply(generatedContent);
    setIsOpen(false);
    setGeneratedContent("");
    toast.success("Content applied");
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-primary"
          title={`AI assist for ${fieldLabels[targetField]}`}
        >
          <Sparkles className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Assist: {fieldLabels[targetField]}
          </DialogTitle>
          <DialogDescription>
            Enter rough notes and let AI transform them into professional STAR
            format content
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="raw-notes">Your Notes</Label>
            <Textarea
              id="raw-notes"
              value={rawNotes}
              onChange={(e) => setRawNotes(e.target.value)}
              rows={4}
              placeholder="Enter bullet points, rough notes, or key details..."
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Include key details, metrics, technologies, and outcomes
            </p>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={isLoading || !rawNotes.trim()}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate {fieldLabels[targetField]}
              </>
            )}
          </Button>

          {generatedContent && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Generated Content</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <div className="rounded-lg bg-secondary/50 p-4">
                <p className="text-sm whitespace-pre-wrap">{generatedContent}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleApply}
                  className="flex-1"
                >
                  Apply Content
                </Button>
                <Button
                  variant="outline"
                  onClick={handleGenerate}
                >
                  Regenerate
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
