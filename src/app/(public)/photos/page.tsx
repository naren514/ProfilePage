import { Metadata } from "next";
import { getSiteSettings, getPhotoSettings } from "@/lib/settings";
import { PhotoGallery } from "@/components/photos/photo-gallery";
import { Container, EmptyState, PageHeader } from "@/components/site/ui";

export const metadata: Metadata = {
  title: "Photo Journal",
  description: "Pictures I have taken along the way.",
};

export const dynamic = "force-dynamic";

export default async function PhotosPage() {
  const settings = await getSiteSettings();
  const photos = getPhotoSettings(settings);

  return (
    <Container>
      <PageHeader eyebrow="Photos" title="Photo journal" description="Pictures I've taken along the way." />
      {photos.length > 0 ? <PhotoGallery photos={photos} /> : <EmptyState>No photos yet. Check back soon.</EmptyState>}
    </Container>
  );
}
