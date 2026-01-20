"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Upload, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface StoryData {
  title: string;
  summary: string;
  company: string;
  role: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  lessonsLearned: string;
  tags: string[];
}

interface StoryImportProps {
  onImport: (data: StoryData) => void;
}

export function StoryImport({ onImport }: StoryImportProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [textContent, setTextContent] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file type
      const allowedTypes = [
        "text/plain",
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ];
      if (!allowedTypes.includes(file.type)) {
        toast.error("Please upload a .txt, .pdf, .doc, or .docx file");
        return;
      }
      setSelectedFile(file);
    }
  };

  const extractTextFromFile = async (file: File): Promise<string> => {
    // For text files, read directly
    if (file.type === "text/plain") {
      return await file.text();
    }

    // For other files, we'll need to upload and process
    // For now, we'll use a simple approach - upload the file content
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/admin/extract-text", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error("Failed to extract text from file");
    }

    const data = await response.json();
    return data.text;
  };

  const handleAnalyze = async () => {
    let content = textContent;

    // If file is selected, extract text from it
    if (selectedFile && !textContent) {
      try {
        content = await extractTextFromFile(selectedFile);
      } catch (error) {
        console.error("File extraction error:", error);
        toast.error("Failed to read file. Please paste the text directly.");
        return;
      }
    }

    if (!content.trim()) {
      toast.error("Please enter or paste some content to analyze");
      return;
    }

    setIsAnalyzing(true);

    try {
      const response = await fetch("/api/admin/analyze-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        throw new Error("Failed to analyze content");
      }

      const data = await response.json();
      onImport(data);
      setIsOpen(false);
      setTextContent("");
      setSelectedFile(null);
      toast.success("Story content analyzed and populated!");
    } catch (error) {
      console.error("Analyze error:", error);
      toast.error("Failed to analyze content");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Sparkles className="mr-2 h-4 w-4" />
          Import with AI
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Story with AI</DialogTitle>
          <DialogDescription>
            Paste text or upload a document. AI will analyze it and populate the
            STAR format fields automatically.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="text" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="text">
              <FileText className="mr-2 h-4 w-4" />
              Paste Text
            </TabsTrigger>
            <TabsTrigger value="upload">
              <Upload className="mr-2 h-4 w-4" />
              Upload File
            </TabsTrigger>
          </TabsList>

          <TabsContent value="text" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="storyText">Story Content</Label>
              <Textarea
                id="storyText"
                placeholder="Paste your story, experience, or any text here. It can be rough notes, a project description, or even an email thread. The AI will extract and structure the relevant information..."
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                rows={12}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Tip: Include details about the situation, your actions, and the
                results/impact for best results.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="upload" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fileUpload">Upload Document</Label>
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                <input
                  id="fileUpload"
                  type="file"
                  accept=".txt,.pdf,.doc,.docx"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label
                  htmlFor="fileUpload"
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  <Upload className="h-10 w-10 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Click to upload or drag and drop
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Supports .txt, .pdf, .doc, .docx
                  </span>
                </label>
                {selectedFile && (
                  <div className="mt-4 p-2 bg-secondary rounded text-sm">
                    Selected: {selectedFile.name}
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Note: For best results with PDF/Word files, you may want to copy
                and paste the text directly.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAnalyze}
            disabled={isAnalyzing || (!textContent.trim() && !selectedFile)}
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Analyze & Populate
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
