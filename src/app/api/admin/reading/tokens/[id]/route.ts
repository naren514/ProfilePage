import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/http/errors";
import { readingRoute } from "@/lib/reading/api";
import { revokeToken } from "@/lib/reading/tokens";

export const dynamic = "force-dynamic";

export async function DELETE(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return readingRoute(async () => {
    if (!z.string().uuid().safeParse(params.id).success || !(await revokeToken(params.id))) {
      return apiError("NOT_FOUND", "This token doesn't exist or was already revoked.", 404);
    }
    return NextResponse.json({ ok: true });
  });
}
