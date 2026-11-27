import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { readingSources } from "@/lib/db/schema";
import { apiError } from "@/lib/http/errors";
import { idSchema, json, writingRoute } from "@/lib/writing/api";

export const dynamic = "force-dynamic";

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  return writingRoute(async () => {
    if (!idSchema.safeParse(params.id).success) return apiError("NOT_FOUND", "Source not found", 404);
    const [row] = await db.delete(readingSources).where(eq(readingSources.id, params.id)).returning({ id: readingSources.id });
    if (!row) return apiError("NOT_FOUND", "Source not found", 404);
    return json({ ok: true });
  });
}
