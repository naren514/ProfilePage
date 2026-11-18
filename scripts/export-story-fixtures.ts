/**
 * Exports every Thoughts post (the `stories` table) to a local JSON file so the
 * upcoming Writing Studio migration can be tested against real content.
 *
 *   npx tsx scripts/export-story-fixtures.ts [output-path]
 *
 * The default output path is gitignored because it includes unpublished drafts.
 */
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { mkdirSync, writeFileSync } from "fs";

config({ path: resolve(process.cwd(), ".env.local") });

import { neon } from "@neondatabase/serverless";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL not found in .env.local");
    process.exit(1);
  }
  const sql = neon(process.env.DATABASE_URL);
  const rows = await sql`SELECT * FROM stories ORDER BY created_at`;

  const out = resolve(process.argv[2] || "tests/fixtures/local/legacy-stories.json");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({ exportedAt: new Date().toISOString(), rows }, null, 2));

  const legacyFields = ["situation", "task", "result", "lessons_learned", "company", "role"];
  const withLegacy = rows.filter((r) => legacyFields.some((f) => typeof r[f] === "string" && r[f].trim()));
  const withImages = rows.filter((r) => typeof r.action === "string" && /<img\b/i.test(r.action));
  console.log(`Exported ${rows.length} posts to ${out}`);
  console.log(`  published: ${rows.filter((r) => r.is_published).length}`);
  console.log(`  using legacy STAR fields: ${withLegacy.length}`);
  console.log(`  containing images: ${withImages.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
