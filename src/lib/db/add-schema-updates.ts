import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not found in .env.local");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

async function updateSchema() {
  console.log("Adding new columns and tables...");

  try {
    // Add new columns to users table
    await sql`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS image text,
      ADD COLUMN IF NOT EXISTS google_id text UNIQUE
    `;
    console.log("  ✓ Added image and google_id columns to users");

    // Make password_hash nullable for Google auth users
    await sql`
      ALTER TABLE users
      ALTER COLUMN password_hash DROP NOT NULL
    `;
    console.log("  ✓ Made password_hash nullable");

    // Create site_settings table
    await sql`
      CREATE TABLE IF NOT EXISTS site_settings (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        key text NOT NULL UNIQUE,
        value jsonb NOT NULL,
        category text NOT NULL DEFAULT 'general',
        label text,
        description text,
        updated_at timestamp DEFAULT now() NOT NULL,
        updated_by uuid
      )
    `;
    console.log("  ✓ Created site_settings table");

    console.log("\nSchema updates complete!");
  } catch (error) {
    console.error("Schema update failed:", error);
    process.exit(1);
  }
}

updateSchema().then(() => process.exit(0));
