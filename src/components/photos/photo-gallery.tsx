"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, MapPin, X } from "lucide-react";
import type { PhotoEntry } from "@/lib/settings";

interface PhotoGalleryProps {
  photos: PhotoEntry[];
}

function formatDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return "";
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function PhotoMeta({ photo }: { photo: PhotoEntry }) {
  const date = photo.takenAt ? formatDate(photo.takenAt) : "";
  if (!photo.location && !date) return null;

  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {photo.location && (
        <span className="inline-flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5" />
          {photo.location}
        </span>
      )}
      {photo.location && date && <span>·</span>}
      {date && <span>{date}</span>}
    </span>
  );
}

export function PhotoGallery({ photos }: PhotoGalleryProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const openPhoto = openIndex === null ? null : photos[openIndex];

  const step = useCallback(
    (delta: number) => {
      setOpenIndex((current) =>
        current === null ? null : (current + delta + photos.length) % photos.length
      );
    },
    [photos.length]
  );

  useEffect(() => {
    if (openIndex === null) return;

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenIndex(null);
      if (event.key === "ArrowRight") step(1);
      if (event.key === "ArrowLeft") step(-1);
    };

    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [openIndex, step]);

  return (
    <>
      <div className="columns-1 gap-5 sm:columns-2 lg:columns-3">
        {photos.map((photo, index) => (
          <figure key={photo.id} className="mb-5 break-inside-avoid">
            <button
              type="button"
              onClick={() => setOpenIndex(index)}
              className="group block w-full overflow-hidden rounded-2xl border border-border/60 bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.thumbUrl}
                alt={photo.caption || "Photo"}
                width={photo.width}
                height={photo.height}
                loading="lazy"
                className="h-auto w-full transition-transform duration-300 group-hover:scale-[1.02]"
              />
            </button>
            {(photo.caption || photo.location || photo.takenAt) && (
              <figcaption className="mt-2.5 px-1">
                {photo.caption && <p className="text-sm font-medium">{photo.caption}</p>}
                <div className="mt-1 text-xs text-muted-foreground">
                  <PhotoMeta photo={photo} />
                </div>
              </figcaption>
            )}
          </figure>
        ))}
      </div>

      {openPhoto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={openPhoto.caption || "Photo"}
          className="fixed inset-0 z-[60] flex flex-col bg-black/95 text-white"
          onClick={() => setOpenIndex(null)}
        >
          <div className="flex justify-end p-4">
            <button
              type="button"
              aria-label="Close"
              className="rounded-full p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              onClick={() => setOpenIndex(null)}
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 sm:px-16">
            {photos.length > 1 && (
              <button
                type="button"
                aria-label="Previous photo"
                className="absolute left-2 rounded-full p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white sm:left-4"
                onClick={(event) => {
                  event.stopPropagation();
                  step(-1);
                }}
              >
                <ChevronLeft className="h-8 w-8" />
              </button>
            )}

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={openPhoto.id}
              src={openPhoto.url}
              alt={openPhoto.caption || "Photo"}
              className="max-h-full max-w-full rounded-lg object-contain"
              onClick={(event) => event.stopPropagation()}
            />

            {photos.length > 1 && (
              <button
                type="button"
                aria-label="Next photo"
                className="absolute right-2 rounded-full p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white sm:right-4"
                onClick={(event) => {
                  event.stopPropagation();
                  step(1);
                }}
              >
                <ChevronRight className="h-8 w-8" />
              </button>
            )}
          </div>

          <div className="min-h-[4.5rem] px-6 py-4 text-center" onClick={(event) => event.stopPropagation()}>
            {openPhoto.caption && <p className="text-sm font-medium">{openPhoto.caption}</p>}
            <div className="mt-1 flex justify-center text-xs text-white/60">
              <PhotoMeta photo={openPhoto} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
