/**
 * Sample Resume Data Seed Script
 *
 * This script seeds the database with sample experience and certification data.
 * Replace this data with your own information before running.
 *
 * Usage: npm run db:seed
 */

import { config } from "dotenv";
import { resolve } from "path";

// Load env before anything else
config({ path: resolve(process.cwd(), ".env.local") });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { experiences, certifications } from "./schema";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not found in .env.local");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const db = drizzle(sql);

// ==========================================
// SAMPLE DATA - Replace with your own!
// ==========================================

const experienceData = [
  {
    company: "Example Tech Company",
    title: "Senior Software Engineer",
    location: "San Francisco, CA",
    employmentType: "full-time",
    startDate: "2022-01-01",
    endDate: null,
    isCurrent: true,
    description:
      "Lead development of cloud-native applications and microservices architecture.",
    achievements: [
      "Reduced deployment time by 60% through implementation of CI/CD pipelines",
      "Led migration of monolithic application to microservices, improving scalability",
      "Mentored team of 5 junior developers, improving team velocity by 30%",
      "Implemented observability stack reducing incident response time by 40%",
    ],
    technologies: ["AWS", "Kubernetes", "TypeScript", "React", "PostgreSQL"],
    sortOrder: 1,
  },
  {
    company: "Previous Corp",
    title: "Software Engineer",
    location: "New York, NY",
    employmentType: "full-time",
    startDate: "2019-06-01",
    endDate: "2021-12-31",
    isCurrent: false,
    description:
      "Developed and maintained enterprise web applications for financial services clients.",
    achievements: [
      "Built real-time data processing pipeline handling 1M+ events/day",
      "Designed REST APIs serving 100k+ daily active users",
      "Implemented automated testing strategy achieving 85% code coverage",
      "Contributed to open-source libraries used by 500+ developers",
    ],
    technologies: ["Node.js", "Python", "Docker", "MongoDB", "Redis"],
    sortOrder: 2,
  },
  {
    company: "Startup Inc",
    title: "Junior Developer",
    location: "Austin, TX",
    employmentType: "full-time",
    startDate: "2017-08-01",
    endDate: "2019-05-31",
    isCurrent: false,
    description:
      "Full-stack development for B2B SaaS platform.",
    achievements: [
      "Developed customer-facing dashboard used by 200+ enterprise clients",
      "Optimized database queries reducing page load time by 50%",
      "Built integration with third-party payment processors",
      "Participated in agile development with 2-week sprints",
    ],
    technologies: ["JavaScript", "React", "Express", "MySQL", "AWS"],
    sortOrder: 3,
  },
];

const certificationData = [
  {
    articleTitle: "AWS Solutions Architect – Professional",
    source: "Amazon Web Services",
    publishedDate: "2023-06-01",
    followUpDate: "2026-06-01",
    isPublished: true,
    sortOrder: 1,
  },
  {
    articleTitle: "Google Cloud Professional Cloud Architect",
    source: "Google Cloud",
    publishedDate: "2023-01-15",
    followUpDate: "2025-01-15",
    isPublished: true,
    sortOrder: 2,
  },
  {
    articleTitle: "Certified Kubernetes Administrator (CKA)",
    source: "Cloud Native Computing Foundation",
    publishedDate: "2022-09-01",
    followUpDate: "2025-09-01",
    isPublished: true,
    sortOrder: 3,
  },
];

async function seedResumeData() {
  console.log("🌱 Seeding sample experience data...");
  console.log("⚠️  Note: This is sample data. Replace with your own!\n");

  // Insert experiences
  for (const exp of experienceData) {
    await db.insert(experiences).values(exp);
    console.log(`  ✓ Added: ${exp.title} at ${exp.company}`);
  }

  console.log("\n🌱 Seeding sample certification data...");

  // Insert certifications
  for (const cert of certificationData) {
    await db.insert(certifications).values(cert);
    console.log(`  ✓ Added: ${cert.articleTitle}`);
  }

  console.log("\n✅ Seeding complete!");
  console.log("\n📝 Next steps:");
  console.log("   1. Go to /admin to manage your content");
  console.log("   2. Update the sample data with your real experience");
  console.log("   3. Configure Settings with your name and contact info");
}

// Run the seed function
seedResumeData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  });
