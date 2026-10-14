"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import type { PhotoEntry } from "@/lib/settings";

const FULL_MAX_EDGE = 2400;
const THUMB_MAX_EDGE = 900;
// Keep under the 4MB the upload API accepts
const FULL_MAX_BYTES = 3.5 * 1024 * 1024;

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not encode photo"))),
      "image/jpeg",
      quality
    );
  });
}

// Re-encoding in the browser keeps uploads small and drops camera metadata
// such as GPS coordinates before the file leaves the device.
async function resizePhoto(bitmap: ImageBitmap, maxEdge: number, maxBytes?: number) {
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not process photo");
  context.drawImage(bitmap, 0, 0, width, height);

  let quality = 0.85;
  let blob = await toJpeg(canvas, quality);
  while (maxBytes && blob.size > maxBytes && quality > 0.5) {
    quality -= 0.1;
    blob = await toJpeg(canvas, quality);
  }

  return { blob, width, height };
}

function toDateInput(timestamp: number): string {
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export default function PhotosAdminPage() {
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function fetchPhotos() {
      try {
        const response = await fetch("/api/admin/photos");
        if (response.ok) {
          setPhotos(await response.json());
        }
      } catch (error) {
        console.error("Fetch error:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchPhotos();
  }, []);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const selected = Array.from(files);
    let uploaded = 0;

    for (let index = 0; index < selected.length; index++) {
      const file = selected[index];
      setUploadStatus(`Uploading ${index + 1} of ${selected.length}: ${file.name}`);

      try {
        let bitmap: ImageBitmap;
        try {
          bitmap = await createImageBitmap(file);
        } catch {
          throw new Error("this browser cannot read the file. Export it as JPEG or PNG first.");
        }

        const full = await resizePhoto(bitmap, FULL_MAX_EDGE, FULL_MAX_BYTES);
        const thumb = await resizePhoto(bitmap, THUMB_MAX_EDGE);
        bitmap.close();

        const formData = new FormData();
        formData.append("image", full.blob, "photo.jpg");
        formData.append("thumb", thumb.blob, "thumb.jpg");
        formData.append("width", String(full.width));
        formData.append("height", String(full.height));
        formData.append("takenAt", toDateInput(file.lastModified));

        const response = await fetch("/api/admin/photos", { method: "POST", body: formData });
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || "upload failed");
        }

        const entry: PhotoEntry = await response.json();
        setPhotos((prev) => [entry, ...prev]);
        uploaded += 1;
      } catch (error) {
        console.error("Upload error:", error);
        toast.error(`${file.name}: ${error instanceof Error ? error.message : "upload failed"}`);
      }
    }

    setUploadStatus(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (uploaded > 0) {
      toast.success(uploaded === 1 ? "Photo uploaded" : `${uploaded} photos uploaded`);
    }
  };

  const updateField = (id: string, field: "caption" | "location" | "takenAt", value: string) => {
    setPhotos((prev) =>
      prev.map((photo) => (photo.id === id ? { ...photo, [field]: value } : photo))
    );
  };

  const handleSave = async (photo: PhotoEntry) => {
    setSavingId(photo.id);
    try {
      const response = await fetch("/api/admin/photos", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: photo.id,
          caption: photo.caption,
          location: photo.location,
          takenAt: photo.takenAt,
        }),
      });
      if (!response.ok) throw new Error("Failed to save");
      toast.success("Photo details saved");
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Failed to save photo details");
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this photo?")) return;

    try {
      const response = await fetch(`/api/admin/photos?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete");
      setPhotos((prev) => prev.filter((photo) => photo.id !== id));
      toast.success("Photo deleted");
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete photo");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Photo Journal</h1>
          <p className="text-muted-foreground mt-2">
            Upload pictures and add a caption, place, and date. Photos are resized in your
            browser before upload, and camera metadata such as GPS location is removed.
          </p>
        </div>
      </div>

      <Card className="bg-card/50 border-border/60">
        <CardContent className="pt-6">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <div className="flex flex-wrap items-center gap-4">
            <Button onClick={() => fileInputRef.current?.click()} disabled={uploadStatus !== null}>
              {uploadStatus ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Upload Photos
            </Button>
            <p className="text-sm text-muted-foreground">
              {uploadStatus ?? "Choose one or more images. The Photos page appears in the site menu once there is at least one photo."}
            </p>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : photos.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">No photos yet.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {photos.map((photo) => (
            <Card key={photo.id} className="bg-card/50 border-border/60 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.thumbUrl}
                alt={photo.caption || "Photo"}
                className="aspect-[4/3] w-full object-cover"
              />
              <CardContent className="space-y-3 pt-4">
                <div className="space-y-1.5">
                  <Label htmlFor={`caption-${photo.id}`}>Caption</Label>
                  <Input
                    id={`caption-${photo.id}`}
                    value={photo.caption}
                    onChange={(e) => updateField(photo.id, "caption", e.target.value)}
                    placeholder="What is this a picture of?"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor={`location-${photo.id}`}>Place</Label>
                    <Input
                      id={`location-${photo.id}`}
                      value={photo.location}
                      onChange={(e) => updateField(photo.id, "location", e.target.value)}
                      placeholder="Banff, AB"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`takenAt-${photo.id}`}>Date taken</Label>
                    <Input
                      id={`takenAt-${photo.id}`}
                      type="date"
                      value={photo.takenAt}
                      onChange={(e) => updateField(photo.id, "takenAt", e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <Button size="sm" onClick={() => handleSave(photo)} disabled={savingId === photo.id}>
                    {savingId === photo.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(photo.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
