"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Upload, File, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

const categories = [
  { value: "resume", label: "Resume" },
  { value: "certification", label: "Certification" },
  { value: "project", label: "Project Documentation" },
  { value: "general", label: "General" },
];

export function DocumentUploader() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState("general");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingStatus, setProcessingStatus] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Check file type
      const allowedTypes = [
        "application/pdf",
        "text/plain",
        "text/markdown",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ];

      if (!allowedTypes.includes(selectedFile.type)) {
        toast.error("Invalid file type. Please upload PDF, TXT, MD, or DOC files.");
        return;
      }

      // Check file size (max 10MB)
      if (selectedFile.size > 10 * 1024 * 1024) {
        toast.error("File too large. Maximum size is 10MB.");
        return;
      }

      setFile(selectedFile);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      const allowedTypes = [
        "application/pdf",
        "text/plain",
        "text/markdown",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ];

      if (!allowedTypes.includes(droppedFile.type)) {
        toast.error("Invalid file type. Please upload PDF, TXT, MD, or DOC files.");
        return;
      }

      if (droppedFile.size > 10 * 1024 * 1024) {
        toast.error("File too large. Maximum size is 10MB.");
        return;
      }

      setFile(droppedFile);
    }
  }, []);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(0);
    setProcessingStatus("Uploading file...");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", category);

      // Simulate progress for upload
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 40));
      }, 200);

      const uploadResponse = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload file");
      }

      const { documentId } = await uploadResponse.json();
      setUploadProgress(50);
      setProcessingStatus("Processing and generating embeddings...");

      // Trigger embedding generation
      const embedResponse = await fetch("/api/embed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId }),
      });

      if (!embedResponse.ok) {
        throw new Error("Failed to generate embeddings");
      }

      // Simulate embedding progress
      for (let i = 50; i <= 100; i += 10) {
        await new Promise((r) => setTimeout(r, 500));
        setUploadProgress(i);
      }

      setProcessingStatus("Complete!");
      toast.success("Document uploaded and processed successfully");
      setFile(null);
      router.refresh();
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload document");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      setProcessingStatus(null);
    }
  };

  return (
    <Card className="bg-card/50 border-border/60">
      <CardHeader>
        <CardTitle>Upload Document</CardTitle>
        <CardDescription>
          Upload a document to add to the RAG knowledge base
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            file ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground"
          }`}
        >
          {file ? (
            <div className="flex items-center justify-center gap-3">
              <File className="h-8 w-8 text-primary" />
              <div className="text-left">
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setFile(null)}
                disabled={isUploading}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">
                Drag and drop a file here, or click to select
              </p>
              <p className="text-xs text-muted-foreground">
                Supported: PDF, TXT, MD, DOC, DOCX (max 10MB)
              </p>
            </div>
          )}
          <Input
            type="file"
            accept=".pdf,.txt,.md,.doc,.docx"
            onChange={handleFileChange}
            className="hidden"
            id="file-upload"
            disabled={isUploading}
          />
          {!file && (
            <Label
              htmlFor="file-upload"
              className="inline-block mt-4 px-4 py-2 bg-secondary rounded-md cursor-pointer hover:bg-secondary/80"
            >
              Select File
            </Label>
          )}
        </div>

        {/* Category selection */}
        <div className="space-y-2">
          <Label>Category</Label>
          <Select value={category} onValueChange={setCategory} disabled={isUploading}>
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Progress */}
        {isUploading && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{processingStatus}</span>
              <span>{uploadProgress}%</span>
            </div>
            <Progress value={uploadProgress} />
          </div>
        )}

        {/* Upload button */}
        <Button
          onClick={handleUpload}
          disabled={!file || isUploading}
          className="w-full"
        >
          {isUploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Upload and Process
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
