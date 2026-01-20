// Text chunking for document processing
// Uses recursive character text splitting with overlap

export interface ChunkMetadata {
  pageNumber?: number;
  section?: string;
  heading?: string;
}

export interface TextChunk {
  content: string;
  index: number;
  tokenCount: number;
  metadata: ChunkMetadata;
}

// Approximate token count (rough estimate: 1 token ≈ 4 characters)
function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

// Split text by separators recursively
function splitTextBySeparators(
  text: string,
  separators: string[],
  chunkSize: number,
  overlap: number
): string[] {
  if (separators.length === 0) {
    // Base case: no more separators, split by character count
    return splitByCharacterCount(text, chunkSize, overlap);
  }

  const separator = separators[0];
  const remainingSeparators = separators.slice(1);

  const splits = text.split(separator);

  const chunks: string[] = [];
  let currentChunk = "";

  for (const split of splits) {
    const testChunk = currentChunk
      ? currentChunk + separator + split
      : split;

    if (estimateTokenCount(testChunk) <= chunkSize) {
      currentChunk = testChunk;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
      }

      // If the split itself is too large, recursively split it
      if (estimateTokenCount(split) > chunkSize) {
        const subChunks = splitTextBySeparators(
          split,
          remainingSeparators,
          chunkSize,
          overlap
        );
        chunks.push(...subChunks);
        currentChunk = "";
      } else {
        currentChunk = split;
      }
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  // Add overlap between chunks
  if (overlap > 0 && chunks.length > 1) {
    return addOverlap(chunks, overlap);
  }

  return chunks;
}

// Split by character count with overlap
function splitByCharacterCount(
  text: string,
  chunkSize: number,
  overlap: number
): string[] {
  const charChunkSize = chunkSize * 4; // Convert token count to character count
  const charOverlap = overlap * 4;

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + charChunkSize, text.length);
    chunks.push(text.slice(start, end));
    start = end - charOverlap;

    // Prevent infinite loop
    if (start >= text.length - charOverlap) {
      break;
    }
  }

  return chunks;
}

// Add overlap to existing chunks
function addOverlap(chunks: string[], overlapTokens: number): string[] {
  const overlapChars = overlapTokens * 4;
  const result: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    let chunk = chunks[i];

    // Add overlap from previous chunk at the beginning
    if (i > 0) {
      const prevChunk = chunks[i - 1];
      const overlapText = prevChunk.slice(-overlapChars);
      chunk = overlapText + chunk;
    }

    result.push(chunk.trim());
  }

  return result;
}

// Extract headings from text for metadata
function extractHeading(text: string): string | undefined {
  const lines = text.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    // Check for markdown headings
    if (trimmed.startsWith("#")) {
      return trimmed.replace(/^#+\s*/, "");
    }
    // Check for uppercase headings (common in documents)
    if (trimmed.length < 100 && trimmed === trimmed.toUpperCase() && trimmed.length > 3) {
      return trimmed;
    }
  }
  return undefined;
}

// Main chunking function
export function chunkDocument(
  text: string,
  options: {
    chunkSize?: number; // in tokens
    overlap?: number; // in tokens
    baseMetadata?: Partial<ChunkMetadata>;
  } = {}
): TextChunk[] {
  const { chunkSize = 500, overlap = 50, baseMetadata = {} } = options;

  // Separators in order of preference (larger to smaller units)
  const separators = [
    "\n\n\n", // Triple newline (major sections)
    "\n\n", // Double newline (paragraphs)
    "\n", // Single newline
    ". ", // Sentence end
    "! ", // Exclamation
    "? ", // Question
    "; ", // Semicolon
    ", ", // Comma
    " ", // Space
  ];

  // Clean the text
  const cleanedText = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/ +/g, " ")
    .trim();

  if (!cleanedText) {
    return [];
  }

  // Split into chunks
  const rawChunks = splitTextBySeparators(
    cleanedText,
    separators,
    chunkSize,
    overlap
  );

  // Create TextChunk objects with metadata
  return rawChunks.map((content, index) => ({
    content: content.trim(),
    index,
    tokenCount: estimateTokenCount(content),
    metadata: {
      ...baseMetadata,
      heading: extractHeading(content),
    },
  }));
}

// Process PDF text (handles page breaks)
export function chunkPdfText(
  pages: Array<{ pageNumber: number; text: string }>,
  options: {
    chunkSize?: number;
    overlap?: number;
  } = {}
): TextChunk[] {
  const allChunks: TextChunk[] = [];
  let globalIndex = 0;

  for (const page of pages) {
    const pageChunks = chunkDocument(page.text, {
      ...options,
      baseMetadata: { pageNumber: page.pageNumber },
    });

    for (const chunk of pageChunks) {
      allChunks.push({
        ...chunk,
        index: globalIndex++,
      });
    }
  }

  return allChunks;
}
