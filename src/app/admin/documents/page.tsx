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
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Documents</h1>
        <p className="text-muted-foreground">
          Upload and manage documents for the RAG system
        </p>
      </div>

      <DocumentUploader />
      <RAGSyncButton />
      <DocumentList documents={docList} />
    </div>
  );
}
