import { put } from "@vercel/blob";
import { v4 as uuidv4 } from "uuid";
import { apiError } from "@/lib/http/errors";
import { json, writingRoute } from "@/lib/writing/api";

export const dynamic = "force-dynamic";

// Vercel rejects request bodies over 4.5MB
const MAX_BYTES = 4 * 1024 * 1024;
const TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/** Upload an image for use inside a post. */
export async function POST(request: Request) {
  return writingRoute(async () => {
    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return apiError("VALIDATION_FAILED", "No image was uploaded.", 400);
    const ext = TYPES[file.type];
    if (!ext) return apiError("UNSUPPORTED_MEDIA", "Images must be JPEG, PNG, WebP or GIF.", 415);
    if (file.size > MAX_BYTES) return apiError("UNSUPPORTED_MEDIA", "Images must be 4 MB or smaller.", 413);
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return apiError("INTERNAL", "Image storage isn't configured (BLOB_READ_WRITE_TOKEN is missing).", 500);
    }
    const blob = await put(`thoughts/${uuidv4()}.${ext}`, file, { access: "public", contentType: file.type });
    return json({ url: blob.url });
  });
}
