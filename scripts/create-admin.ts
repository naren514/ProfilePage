/**
 * Admin User Creation Script
 *
 * SECURITY: This script should ONLY be run in development/setup contexts.
 * It is excluded from production builds and deployments.
 *
 * Usage: ADMIN_EMAIL=xxx ADMIN_PASSWORD=xxx npx tsx scripts/create-admin.ts
 */

import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { users } from "../src/lib/db/schema";

config({ path: ".env.local" });

// Security guard: Prevent accidental production execution
if (process.env.NODE_ENV === "production" && !process.env.ALLOW_ADMIN_SCRIPT) {
  console.error("ERROR: This script should not be run in production.");
  console.error("If you must run it, set ALLOW_ADMIN_SCRIPT=true");
  process.exit(1);
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + process.env.NEXTAUTH_SECRET);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function createAdmin() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL not set");
  }

  // Get credentials from environment variables (not hardcoded)
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || "Admin User";

  if (!email || !password) {
    console.error("ERROR: ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required.");
    console.error("Usage: ADMIN_EMAIL=xxx ADMIN_PASSWORD=xxx npx tsx scripts/create-admin.ts");
    process.exit(1);
  }

  // Password strength validation
  if (password.length < 12) {
    console.error("ERROR: Password must be at least 12 characters long.");
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  const db = drizzle(sql);

  const passwordHash = await hashPassword(password);

  console.log("Creating admin user...");

  await db.insert(users).values({
    email,
    passwordHash,
    name,
    role: "admin",
  });

  console.log(`Admin user created!`);
  console.log(`Email: ${email}`);
  console.log("\nPassword was set from ADMIN_PASSWORD environment variable.");
}

createAdmin().catch(console.error);
