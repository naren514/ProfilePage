import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  const docs = await sql`SELECT id, original_name, is_active, chunk_count FROM documents LIMIT 10`;
  console.log("Documents:", docs);

  const chunks = await sql`SELECT COUNT(*) as count FROM document_chunks`;
  console.log("Chunk count:", chunks);

  const chunksWithEmbedding = await sql`SELECT COUNT(*) as count FROM document_chunks WHERE embedding IS NOT NULL`;
  console.log("Chunks with embeddings:", chunksWithEmbedding);
}

main().catch(console.error);
