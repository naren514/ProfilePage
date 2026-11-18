import { createIdea, ideaInputSchema, listIdeas, type IdeaFilter } from "@/lib/writing/ideas";
import { json, parseBody, writingRoute } from "@/lib/writing/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return writingRoute(async () => {
    const url = new URL(request.url);
    const f = url.searchParams.get("filter");
    const filter: IdeaFilter = f === "converted" || f === "archived" ? f : "inbox";
    return json({ ideas: await listIdeas(filter, url.searchParams.get("q") ?? undefined) });
  });
}

/** Quick capture: one field is enough. */
export async function POST(request: Request) {
  return writingRoute(async () => {
    const body = await parseBody(request, ideaInputSchema);
    if ("error" in body) return body.error;
    return json(await createIdea(body.data), { status: 201 });
  });
}
