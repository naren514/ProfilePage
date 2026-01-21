/**
 * Database Setup Script
 *
 * SECURITY: This script should ONLY be run in development/setup contexts.
 * It is excluded from production builds and deployments.
 */

import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

// Security guard: Prevent accidental production execution
if (process.env.NODE_ENV === "production" && !process.env.ALLOW_SETUP_SCRIPT) {
  console.error("ERROR: This script should not be run in production.");
  console.error("If you must run it, set ALLOW_SETUP_SCRIPT=true");
  process.exit(1);
}

async function setup() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL not set");
  }

  const sql = neon(process.env.DATABASE_URL);

  console.log("Enabling pgvector extension...");
  await sql`CREATE EXTENSION IF NOT EXISTS vector`;
  console.log("pgvector extension enabled!");
}

setup().catch(console.error);
