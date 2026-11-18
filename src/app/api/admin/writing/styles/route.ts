import { createStyle, listStyles, styleInputSchema } from "@/lib/writing/ai/styles";
import { json, parseBody, writingRoute } from "@/lib/writing/api";

export const dynamic = "force-dynamic";

export async function GET() {
  return writingRoute(async () => json({ styles: await listStyles() }));
}

export async function POST(request: Request) {
  return writingRoute(async (user) => {
    const body = await parseBody(request, styleInputSchema);
    if ("error" in body) return body.error;
    return json(await createStyle(body.data, user.email ?? "admin"), { status: 201 });
  });
}
