import { NextRequest, NextResponse } from "next/server";
import { validationError } from "@/lib/http/errors";
import { readingRoute, tokenCreateSchema } from "@/lib/reading/api";
import { createToken, listTokens } from "@/lib/reading/tokens";

export const dynamic = "force-dynamic";

export async function GET() {
  return readingRoute(async () => NextResponse.json({ tokens: await listTokens() }));
}

/** Create a token. The plain token is in this response only. */
export async function POST(request: NextRequest) {
  return readingRoute(async () => {
    const parsed = tokenCreateSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return validationError(parsed.error);
    return NextResponse.json(await createToken(parsed.data.name));
  });
}
