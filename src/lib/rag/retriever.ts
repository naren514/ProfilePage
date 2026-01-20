import { db } from "@/lib/db";
import { documentChunks } from "@/lib/db/schema";
import { sql, eq } from "drizzle-orm";
import { generateEmbedding } from "@/lib/ai/gemini";

export interface RetrievedChunk {
  id: string;
  content: string;
  similarity: number;
  documentId: string;
  documentName: string;
  category: string;
  metadata: {
    pageNumber?: number;
    section?: string;
    heading?: string;
  } | null;
}

// Retrieve similar chunks using pgvector cosine similarity
export async function retrieveSimilarChunks(
  query: string,
  options: {
    topK?: number;
    threshold?: number;
    category?: string;
  } = {}
): Promise<RetrievedChunk[]> {
  const { topK = 5, threshold = 0.4, category } = options;

  // Generate embedding for the query
  const queryEmbedding = await generateEmbedding(query);
  const embeddingVector = `[${queryEmbedding.join(",")}]`;

  // Build the query with optional category filter
  // Using pgvector's cosine distance operator (<=>)
  // Cosine similarity = 1 - cosine distance
  const result = await db.execute(sql`
    SELECT
      dc.id,
      dc.content,
      dc.metadata,
      dc.document_id,
      d.original_name as document_name,
      d.category,
      1 - (dc.embedding <=> ${embeddingVector}::vector) as similarity
    FROM document_chunks dc
    JOIN documents d ON d.id = dc.document_id
    WHERE d.is_active = true
    ${category ? sql`AND d.category = ${category}` : sql``}
    AND dc.embedding IS NOT NULL
    ORDER BY dc.embedding <=> ${embeddingVector}::vector
    LIMIT ${topK}
  `);

  // Filter by threshold and map results
  return (result.rows as Array<{
    id: string;
    content: string;
    metadata: RetrievedChunk["metadata"];
    document_id: string;
    document_name: string;
    category: string;
    similarity: number;
  }>)
    .filter((row) => row.similarity >= threshold)
    .map((row) => ({
      id: row.id,
      content: row.content,
      similarity: row.similarity,
      documentId: row.document_id,
      documentName: row.document_name,
      category: row.category,
      metadata: row.metadata,
    }));
}

// Retrieve chunks for specific document
export async function getDocumentChunks(documentId: string) {
  return db
    .select({
      id: documentChunks.id,
      content: documentChunks.content,
      chunkIndex: documentChunks.chunkIndex,
      tokenCount: documentChunks.tokenCount,
      metadata: documentChunks.metadata,
    })
    .from(documentChunks)
    .where(eq(documentChunks.documentId, documentId))
    .orderBy(documentChunks.chunkIndex);
}

// Get context string from retrieved chunks
export function formatContextFromChunks(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) {
    return "No relevant context found.";
  }

  return chunks
    .map((chunk, index) => {
      const sourceInfo = chunk.metadata?.heading
        ? `[Source: ${chunk.documentName} - ${chunk.metadata.heading}]`
        : `[Source: ${chunk.documentName}]`;

      return `--- Context ${index + 1} (Relevance: ${(chunk.similarity * 100).toFixed(1)}%) ---
${sourceInfo}
${chunk.content}`;
    })
    .join("\n\n");
}

// Hybrid retrieval: keyword + semantic search
export async function hybridRetrieve(
  query: string,
  options: {
    topK?: number;
    threshold?: number;
    category?: string;
    keywordWeight?: number;
  } = {}
): Promise<RetrievedChunk[]> {
  const { topK = 5, threshold = 0.4, category, keywordWeight = 0.3 } = options;

  // Get semantic results
  const semanticResults = await retrieveSimilarChunks(query, {
    topK: topK * 2, // Get more for re-ranking
    threshold: threshold * 0.8, // Lower threshold for initial retrieval
    category,
  });

  // Simple keyword matching for re-ranking
  const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);

  const scoredResults = semanticResults.map((chunk) => {
    const content = chunk.content.toLowerCase();
    const keywordMatches = queryTerms.filter((term) => content.includes(term)).length;
    const keywordScore = keywordMatches / queryTerms.length;

    // Combined score: weighted average of semantic similarity and keyword match
    const combinedScore =
      chunk.similarity * (1 - keywordWeight) + keywordScore * keywordWeight;

    return {
      ...chunk,
      similarity: combinedScore,
    };
  });

  // Sort by combined score and take top K
  return scoredResults
    .sort((a, b) => b.similarity - a.similarity)
    .filter((chunk) => chunk.similarity >= threshold)
    .slice(0, topK);
}

// Multi-query retrieval: generate multiple query variations
export async function multiQueryRetrieve(
  query: string,
  options: {
    topK?: number;
    threshold?: number;
    category?: string;
  } = {}
): Promise<RetrievedChunk[]> {
  const { topK = 5, threshold = 0.4, category } = options;

  // Generate query variations (simple approach)
  const queryVariations = generateQueryVariations(query);

  // Retrieve for each variation
  const allResults: Map<string, RetrievedChunk> = new Map();

  for (const variation of queryVariations) {
    const results = await retrieveSimilarChunks(variation, {
      topK,
      threshold: threshold * 0.9, // Slightly lower threshold
      category,
    });

    for (const result of results) {
      const existing = allResults.get(result.id);
      if (!existing || result.similarity > existing.similarity) {
        allResults.set(result.id, result);
      }
    }
  }

  // Sort by similarity and return top K
  return Array.from(allResults.values())
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
}

// Generate simple query variations
function generateQueryVariations(query: string): string[] {
  const variations = [query];

  // Add question form if not already a question
  if (!query.includes("?")) {
    variations.push(`What is ${query.toLowerCase()}?`);
    variations.push(`Tell me about ${query.toLowerCase()}`);
  }

  // Add keyword-focused variation (extract key nouns)
  const keywords = query
    .split(/\s+/)
    .filter((word) => word.length > 3 && !["what", "how", "where", "when", "about", "tell"].includes(word.toLowerCase()));

  if (keywords.length >= 2) {
    variations.push(keywords.join(" "));
  }

  return variations;
}
