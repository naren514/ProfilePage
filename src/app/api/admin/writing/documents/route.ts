import type { NextRequest } from "next/server";
import { createDocument, importLegacyStories, listDocuments, type DocumentFilter } from "@/lib/writing/documents";
import { json, writingRoute } from "@/lib/writing/api";
import { isSchemaReady } from "@/lib/writing/schema-check";
import { apiError } from "@/lib/http/errors";

export const dynamic = "force-dynamic";

const FILTERS: DocumentFilter[] = ["all", "drafts", "published"];

export async function GET(request: NextRequest) {
  return writingRoute(async (user) => {
    if (!(await isSchemaReady())) {
      return apiError("SETUP_REQUIRED", "The Writing Studio database needs a one-time update.", 503);
    }
    // Posts created outside the Studio (old posts, classic editor) get a draft here
    const imported = await importLegacyStories(user.email ?? "admin");
    const filterParam = request.nextUrl.searchParams.get("filter") as DocumentFilter | null;
    const filter = filterParam && FILTERS.includes(filterParam) ? filterParam : "all";
    const documents = await listDocuments(filter, request.nextUrl.searchParams.get("q") ?? undefined);
    return json({ documents, imported });
  });
}

export async function POST() {
  return writingRoute(async (user) => {
    const doc = await createDocument(user.email ?? "admin");
    return json(doc, { status: 201 });
  });
}
