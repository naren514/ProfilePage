/**
 * Migration script to update vector column from 768 to 3072 dimensions
 * for gemini-embedding-001 model compatibility
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { sql } from 'drizzle-orm';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set in .env.local');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

async function migrateVectorDimension() {
  console.log('🔄 Starting vector dimension migration...\n');

  try {
    // Step 1: Check current vector dimension
    console.log('1️⃣ Checking current vector column info...');
    const columnInfo = await db.execute(sql`
      SELECT column_name, udt_name, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'document_chunks' AND column_name = 'embedding'
    `);
    console.log('   Current column info:', columnInfo.rows[0]);

    // Step 2: Check how many chunks have embeddings
    const chunkCount = await db.execute(sql`
      SELECT
        COUNT(*) as total,
        COUNT(embedding) as with_embedding
      FROM document_chunks
    `);
    console.log('   Chunks:', chunkCount.rows[0]);

    // Step 3: Clear existing embeddings (they're incompatible with new dimension)
    console.log('\n2️⃣ Clearing old 768-dim embeddings...');
    await db.execute(sql`
      UPDATE document_chunks SET embedding = NULL
    `);
    console.log('   ✅ Cleared old embeddings');

    // Step 4: Drop the old vector column
    console.log('\n3️⃣ Dropping old vector column...');
    await db.execute(sql`
      ALTER TABLE document_chunks DROP COLUMN IF EXISTS embedding
    `);
    console.log('   ✅ Dropped old column');

    // Step 5: Add new vector column with 3072 dimensions
    console.log('\n4️⃣ Adding new vector(3072) column...');
    await db.execute(sql`
      ALTER TABLE document_chunks ADD COLUMN embedding vector(3072)
    `);
    console.log('   ✅ Added new column with 3072 dimensions');

    // Step 6: Recreate HNSW index for efficient similarity search
    console.log('\n5️⃣ Creating HNSW index for similarity search...');
    await db.execute(sql`
      DROP INDEX IF EXISTS document_chunks_embedding_idx
    `);
    await db.execute(sql`
      CREATE INDEX document_chunks_embedding_idx
      ON document_chunks
      USING hnsw (embedding vector_cosine_ops)
    `);
    console.log('   ✅ Created HNSW index');

    // Step 7: Verify the change
    console.log('\n6️⃣ Verifying migration...');
    const verifyResult = await db.execute(sql`
      SELECT
        a.attname as column_name,
        format_type(a.atttypid, a.atttypmod) as data_type
      FROM pg_attribute a
      JOIN pg_class c ON a.attrelid = c.oid
      WHERE c.relname = 'document_chunks'
        AND a.attname = 'embedding'
        AND a.attnum > 0
    `);
    console.log('   New column type:', verifyResult.rows[0]);

    console.log('\n✅ Migration complete! Vector column is now 3072 dimensions.');
    console.log('\n⚠️  Next step: Re-generate embeddings for existing documents.');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

migrateVectorDimension().catch(console.error);
