import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isUnauthorizedResponse } from "@/lib/firebase/server-auth";
import { db } from "@/lib/db";
import { documents, documentChunks, tokenUsage } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { chunkDocument } from "@/lib/rag/chunker";
import { generateEmbeddings } from "@/lib/ai/gemini";

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (isUnauthorizedResponse(authResult)) {
      return authResult;
    }

    const { documentId } = await request.json();

    if (!documentId) {
      return NextResponse.json(
        { error: "Document ID is required" },
        { status: 400 }
      );
    }

    // Get document
    const [doc] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1);

    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Fetch document content
    let content: string;

    if (doc.storagePath.startsWith("http")) {
      // Fetch from Vercel Blob
      const response = await fetch(doc.storagePath);
      if (doc.mimeType === "application/pdf") {
        // For PDFs, we'd need a PDF parser - for now, get raw text
        // In production, use pdf-parse or similar
        content = await response.text();
      } else {
        content = await response.text();
      }
    } else {
      // For development, return placeholder
      content = `This is sample content for document: ${doc.originalName}.
      The actual content would be fetched from storage in production.
      This document is categorized as: ${doc.category}.`;
    }

    // Delete existing chunks for this document
    await db
      .delete(documentChunks)
      .where(eq(documentChunks.documentId, documentId));

    // Chunk the document
    const chunks = chunkDocument(content, {
      chunkSize: 500,
      overlap: 50,
    });

    if (chunks.length === 0) {
      return NextResponse.json(
        { error: "No content to process" },
        { status: 400 }
      );
    }

    // Generate embeddings for all chunks
    const chunkTexts = chunks.map((c) => c.content);
    const embeddings = await generateEmbeddings(chunkTexts);

    // Insert chunks with embeddings
    const chunkInserts = chunks.map((chunk, index) => ({
      documentId,
      chunkIndex: chunk.index,
      content: chunk.content,
      tokenCount: chunk.tokenCount,
      embedding: embeddings[index],
      metadata: chunk.metadata,
    }));

    await db.insert(documentChunks).values(chunkInserts);

    // Update document metadata
    await db
      .update(documents)
      .set({
        processedAt: new Date(),
        chunkCount: chunks.length,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, documentId));

    // Track token usage for embedding
    const today = new Date().toISOString().split("T")[0];
    const totalTokens = chunks.reduce((sum, c) => sum + c.tokenCount, 0);

    await db
      .insert(tokenUsage)
      .values({
        date: today,
        model: "text-embedding-004",
        operation: "embedding",
        promptTokens: totalTokens,
        completionTokens: 0,
        requestCount: chunks.length,
      })
      .onConflictDoUpdate({
        target: [tokenUsage.date, tokenUsage.model, tokenUsage.operation],
        set: {
          promptTokens: sql`${tokenUsage.promptTokens} + ${totalTokens}`,
          requestCount: sql`${tokenUsage.requestCount} + ${chunks.length}`,
        },
      });

    return NextResponse.json({
      message: "Embeddings generated successfully",
      chunksProcessed: chunks.length,
    });
  } catch (error) {
    console.error("Embedding generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate embeddings" },
      { status: 500 }
    );
  }
}
