import { NextResponse } from "next/server";
import { requireAuth, isUnauthorizedResponse } from "@/lib/firebase/server-auth";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { fullRAGSync } from "@/lib/rag/sync";

// Get RAG sync status
export async function GET() {
  try {
    const authResult = await requireAuth();
    if (isUnauthorizedResponse(authResult)) {
      return authResult;
    }

    // Get sync document status
    const syncDocs = await db
      .select()
      .from(documents)
      .where(eq(documents.filename, "portfolio_sync.txt"));

    if (syncDocs.length === 0) {
      return NextResponse.json({
        status: "not_synced",
        message: "No RAG sync has been performed yet",
        chunks: 0,
        lastSync: null,
      });
    }

    const syncDoc = syncDocs[0];

    // Get chunk breakdown by entity type
    const chunkBreakdown = await db.execute(sql`
      SELECT
        metadata->>'entityType' as entity_type,
        COUNT(*) as count
      FROM document_chunks
      WHERE document_id = ${syncDoc.id}
      GROUP BY metadata->>'entityType'
    `);

    return NextResponse.json({
      status: "synced",
      documentId: syncDoc.id,
      totalChunks: syncDoc.chunkCount,
      lastSync: syncDoc.processedAt,
      breakdown: chunkBreakdown.rows.reduce((acc, row) => {
        const typedRow = row as { entity_type: string; count: string };
        acc[typedRow.entity_type] = parseInt(typedRow.count);
        return acc;
      }, {} as Record<string, number>),
    });
  } catch (error) {
    console.error("RAG sync status error:", error);
    return NextResponse.json(
      { error: "Failed to get RAG sync status" },
      { status: 500 }
    );
  }
}

// Trigger full RAG sync
export async function POST() {
  try {
    const authResult = await requireAuth();
    if (isUnauthorizedResponse(authResult)) {
      return authResult;
    }

    console.log("Starting full RAG sync from admin...");

    const stats = await fullRAGSync();

    // Update the processed timestamp
    await db
      .update(documents)
      .set({ processedAt: new Date() })
      .where(eq(documents.filename, "portfolio_sync.txt"));

    return NextResponse.json({
      success: true,
      message: "RAG sync completed successfully",
      stats,
    });
  } catch (error) {
    console.error("RAG sync error:", error);
    return NextResponse.json(
      { error: "Failed to perform RAG sync" },
      { status: 500 }
    );
  }
}
