import { Metadata } from "next";
import { getSiteSettings, getPhotoSettings } from "@/lib/settings";
import { PhotoGallery } from "@/components/photos/photo-gallery";

export const metadata: Metadata = {
  title: "Photo Journal",
  description: "Pictures I have taken along the way.",
};

export const dynamic = "force-dynamic";

export default async function PhotosPage() {
  const settings = await getSiteSettings();
  const photos = getPhotoSettings(settings);

  return (
    <div className="pt-24 pb-16">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Photo Journal</h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Pictures I&apos;ve taken along the way.
          </p>
        </div>

        {photos.length > 0 ? (
          <div className="mt-12">
            <PhotoGallery photos={photos} />
          </div>
        ) : (
          <div className="mt-16 text-center">
            <p className="text-muted-foreground">No photos yet. Check back later!</p>
          </div>
        )}
      </div>
    </div>
  );
}
