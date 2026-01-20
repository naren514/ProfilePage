/**
 * Re-generate embeddings for all document chunks using gemini-embedding-001
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { sql } from 'drizzle-orm';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

if (!process.env.GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY is not set');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

// Initialize Gemini embedding model
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const embeddingModel = genAI.getGenerativeModel({
  model: 'gemini-embedding-001',
});

async function generateEmbedding(text: string): Promise<number[]> {
  const result = await embeddingModel.embedContent(text);
  return result.embedding.values;
}

async function regenerateEmbeddings() {
  console.log('🔄 Re-generating embeddings with gemini-embedding-001 (3072 dims)...\n');

  try {
    // Get all chunks
    const chunks = await db.execute(sql`
      SELECT id, content FROM document_chunks ORDER BY id
    `);

    console.log(`📦 Found ${chunks.rows.length} chunks to process\n`);

    let processed = 0;
    let failed = 0;

    for (const row of chunks.rows as Array<{ id: string; content: string }>) {
      try {
        process.stdout.write(`Processing chunk ${processed + 1}/${chunks.rows.length}...`);

        // Generate embedding
        const embedding = await generateEmbedding(row.content);

        // Update in database
        await db.execute(sql`
          UPDATE document_chunks
          SET embedding = ${JSON.stringify(embedding)}::vector
          WHERE id = ${row.id}::uuid
        `);

        processed++;
        console.log(` ✅ (${embedding.length} dims)`);

        // Rate limiting - wait 200ms between requests
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error) {
        failed++;
        console.log(` ❌ Error: ${error}`);
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log(`✅ Processed: ${processed}`);
    console.log(`❌ Failed: ${failed}`);

    // Verify embeddings
    const verify = await db.execute(sql`
      SELECT COUNT(*) as with_embedding
      FROM document_chunks
      WHERE embedding IS NOT NULL
    `);
    console.log(`📊 Chunks with embeddings: ${(verify.rows[0] as { with_embedding: string }).with_embedding}`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

regenerateEmbeddings().catch(console.error);
