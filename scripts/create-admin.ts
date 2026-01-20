import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { users } from "../src/lib/db/schema";

config({ path: ".env.local" });

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

  const sql = neon(process.env.DATABASE_URL);
  const db = drizzle(sql);

  const email = "admin@bharadwazkari.com";
  const password = "admin123"; // Change this!
  const name = "Bharadwaz Kari";

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
  console.log(`Password: ${password}`);
  console.log("\n⚠️  Change the password after first login!");
}

createAdmin().catch(console.error);
