import { NextRequest, NextResponse } from "next/server";
import { del, put } from "@vercel/blob";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { requireAuth, isUnauthorizedResponse } from "@/lib/auth/server-auth";
import { db } from "@/lib/db";
import { siteSettings } from "@/lib/db/schema";
import type { PhotoEntry } from "@/lib/settings";

const SETTINGS_KEY = "photos";
// Vercel rejects request bodies over 4.5MB; the admin page resizes before upload
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_THUMB_BYTES = 1024 * 1024;

async function loadPhotos(): Promise<PhotoEntry[]> {
  const rows = await db
    .select()
    .from(siteSettings)
    .where(eq(siteSettings.key, SETTINGS_KEY))
    .limit(1);
  const value = rows[0]?.value;
  return Array.isArray(value) ? (value as PhotoEntry[]) : [];
}

async function savePhotos(photos: PhotoEntry[], updatedBy: string) {
  await db
    .insert(siteSettings)
    .values({
      key: SETTINGS_KEY,
      value: photos,
      category: "content",
      label: "Photo Journal",
      updatedBy,
    })
    .onConflictDoUpdate({
      target: siteSettings.key,
      set: { value: photos, updatedAt: new Date(), updatedBy },
    });
}

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanDate(value: unknown): string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

export async function GET() {
  try {
    const authResult = await requireAuth();
    if (isUnauthorizedResponse(authResult)) {
      return authResult;
    }

    return NextResponse.json(await loadPhotos());
  } catch (error) {
    console.error("Get photos error:", error);
    return NextResponse.json({ error: "Failed to load photos" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (isUnauthorizedResponse(authResult)) {
      return authResult;
    }

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        {
          error:
            "Photo storage is not set up. Create a Blob store in the Vercel dashboard (Storage > Blob), connect it to this project, and redeploy.",
        },
        { status: 503 }
      );
    }

    const formData = await request.formData();
    const image = formData.get("image");
    const thumb = formData.get("thumb");
    const width = Number(formData.get("width"));
    const height = Number(formData.get("height"));

    if (!(image instanceof File) || !(thumb instanceof File)) {
      return NextResponse.json({ error: "No photo provided" }, { status: 400 });
    }
    if (image.type !== "image/jpeg" || thumb.type !== "image/jpeg") {
      return NextResponse.json({ error: "Photos must be uploaded as JPEG" }, { status: 400 });
    }
    if (image.size > MAX_IMAGE_BYTES || thumb.size > MAX_THUMB_BYTES) {
      return NextResponse.json({ error: "Photo is too large" }, { status: 400 });
    }
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      return NextResponse.json({ error: "Photo dimensions are missing" }, { status: 400 });
    }

    const id = uuidv4();
    const [imageBlob, thumbBlob] = await Promise.all([
      put(`photos/${id}.jpg`, image, { access: "public", contentType: "image/jpeg" }),
      put(`photos/${id}-thumb.jpg`, thumb, { access: "public", contentType: "image/jpeg" }),
    ]);

    const entry: PhotoEntry = {
      id,
      url: imageBlob.url,
      thumbUrl: thumbBlob.url,
      width: Math.round(width),
      height: Math.round(height),
      caption: cleanText(formData.get("caption"), 300),
      location: cleanText(formData.get("location"), 120),
      takenAt: cleanDate(formData.get("takenAt")),
      createdAt: new Date().toISOString(),
    };

    const photos = await loadPhotos();
    await savePhotos([entry, ...photos], authResult.uid);

    return NextResponse.json(entry);
  } catch (error) {
    console.error("Upload photo error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to upload photo" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (isUnauthorizedResponse(authResult)) {
      return authResult;
    }

    const body = await request.json();
    const photos = await loadPhotos();
    const index = photos.findIndex((photo) => photo.id === body.id);
    if (index === -1) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }

    photos[index] = {
      ...photos[index],
      caption: cleanText(body.caption, 300),
      location: cleanText(body.location, 120),
      takenAt: cleanDate(body.takenAt),
    };
    await savePhotos(photos, authResult.uid);

    return NextResponse.json(photos[index]);
  } catch (error) {
    console.error("Update photo error:", error);
    return NextResponse.json({ error: "Failed to update photo" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (isUnauthorizedResponse(authResult)) {
      return authResult;
    }

    const id = request.nextUrl.searchParams.get("id");
    const photos = await loadPhotos();
    const photo = photos.find((item) => item.id === id);
    if (!photo) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }

    await savePhotos(
      photos.filter((item) => item.id !== id),
      authResult.uid
    );

    // The journal entry is already gone; a failed file delete only leaves an orphan
    await del([photo.url, photo.thumbUrl]).catch((error) =>
      console.error("Delete photo files error:", error)
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete photo error:", error);
    return NextResponse.json({ error: "Failed to delete photo" }, { status: 500 });
  }
}
