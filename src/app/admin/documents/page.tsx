import { Metadata } from "next";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { DocumentUploader } from "@/components/admin/document-uploader";
import { DocumentList } from "@/components/admin/document-list";
import { RAGSyncButton } from "@/components/admin/rag-sync-button";

export const metadata: Metadata = {
  title: "Documents | Admin",
};

async function getDocuments() {
  try {
    return await db
      .select()
      .from(documents)
      .orderBy(desc(documents.createdAt));
  } catch {
    return [];
  }
}

export default async function DocumentsPage() {
  const docList = await getDocuments();

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="font-serif text-[2.25rem] font-medium leading-none tracking-tight sm:text-[2.5rem]">Documents</h1>
        <p className="mt-2 max-w-xl text-[0.9375rem] text-muted-foreground">Files the site's chat assistant can draw on.</p>
      </div>

      <DocumentUploader />
      <RAGSyncButton />
      <DocumentList documents={docList} />
    </div>
  );
}
