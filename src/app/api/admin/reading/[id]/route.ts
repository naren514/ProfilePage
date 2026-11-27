import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, validationError } from "@/lib/http/errors";
import { patchSchema, readingRoute } from "@/lib/reading/api";
import { deleteItem, updateItem } from "@/lib/reading/items";

export const dynamic = "force-dynamic";

const notFound = () => apiError("NOT_FOUND", "This article isn't on your reading list any more.", 404);

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return readingRoute(async () => {
    if (!z.string().uuid().safeParse(params.id).success) return notFound();
    const parsed = patchSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return validationError(parsed.error);
    const item = await updateItem(params.id, parsed.data);
    return item ? NextResponse.json({ item }) : notFound();
  });
}

export async function DELETE(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return readingRoute(async () => {
    if (!z.string().uuid().safeParse(params.id).success) return notFound();
    return (await deleteItem(params.id)) ? NextResponse.json({ ok: true }) : notFound();
  });
}
