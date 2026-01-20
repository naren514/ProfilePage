import { config } from "dotenv";
import { resolve } from "path";

// Load env before anything else
config({ path: resolve(process.cwd(), ".env.local") });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import {
  documents,
  documentChunks,
  projects,
  experiences,
  certifications,
  skills,
} from "../src/lib/db/schema";
import { v4 as uuidv4 } from "uuid";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { eq } from "drizzle-orm";

// Initialize Gemini for embeddings
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

async function generateEmbedding(text: string): Promise<number[]> {
  const result = await embeddingModel.embedContent(text);
  return result.embedding.values;
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not found in .env.local");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const db = drizzle(sql);

interface ChunkData {
  content: string;
  section: string;
  heading: string;
}

async function syncRAGData() {
  console.log("🔄 Syncing RAG data from all database tables...\n");

  // Find or create the sync document
  const existingDocs = await db
    .select()
    .from(documents)
    .where(eq(documents.filename, "database_sync.txt"));

  let docId: string;

  if (existingDocs.length > 0) {
    docId = existingDocs[0].id;
    console.log("Found existing sync document:", docId);
    // Delete existing chunks
    await db.delete(documentChunks).where(eq(documentChunks.documentId, docId));
    console.log("Deleted existing chunks");
  } else {
    docId = uuidv4();
    await db.insert(documents).values({
      id: docId,
      filename: "database_sync.txt",
      originalName: "Portfolio Database Content",
      mimeType: "text/plain",
      fileSize: 0,
      storagePath: "synced",
      category: "portfolio",
      isActive: true,
      processedAt: new Date(),
    });
    console.log("Created new sync document:", docId);
  }

  const chunks: ChunkData[] = [];

  // 1. Sync Projects
  console.log("\n📁 Processing Projects...");
  const allProjects = await db.select().from(projects);

  for (const project of allProjects) {
    const projectContent = `
Project: ${project.title}
Company: ${project.company || "Personal Project"}
Role: ${project.role || "Developer"}
${project.websiteUrl ? `Website: ${project.websiteUrl}` : ""}

Summary: ${project.summary}

Situation: ${project.situation}

Task: ${project.task}

Action: ${project.action}

Result: ${project.result}

${project.lessonsLearned ? `Lessons Learned: ${project.lessonsLearned}` : ""}

Technologies Used: ${project.technologies.join(", ")}

${project.startDate ? `Timeline: ${project.startDate} to ${project.endDate || "Present"}` : ""}
    `.trim();

    chunks.push({
      content: projectContent,
      section: "projects",
      heading: `Project: ${project.title}`,
    });

    console.log(`  ✓ ${project.title}`);
  }

  // 2. Sync Experiences
  console.log("\n💼 Processing Experiences...");
  const allExperiences = await db.select().from(experiences);

  for (const exp of allExperiences) {
    const expContent = `
Work Experience: ${exp.title}
Company: ${exp.company}
Location: ${exp.location || "Not specified"}
Employment Type: ${exp.employmentType}
Duration: ${exp.startDate} to ${exp.isCurrent ? "Present" : exp.endDate}
${exp.isCurrent ? "(Current Position)" : ""}

Description: ${exp.description || ""}

Key Achievements:
${exp.achievements?.map((a) => `- ${a}`).join("\n") || "- Various accomplishments in this role"}

Technologies & Skills: ${exp.technologies?.join(", ") || "Various technologies"}
    `.trim();

    chunks.push({
      content: expContent,
      section: "experience",
      heading: `${exp.title} at ${exp.company}`,
    });

    console.log(`  ✓ ${exp.title} @ ${exp.company}`);
  }

  // 3. Sync Certifications
  console.log("\n🏆 Processing Certifications...");
  const allCerts = await db.select().from(certifications);

  // Create a combined certifications chunk
  if (allCerts.length > 0) {
    const certsContent = `
Professional Certifications:

${allCerts
  .map(
    (cert) => `
${cert.name}
- Issuer: ${cert.issuer}
- Credential ID: ${cert.credentialId || "Not provided"}
- Issued: ${cert.issueDate}
- ${cert.expirationDate ? `Expires: ${cert.expirationDate}` : "No Expiration"}
- Status: ${cert.isActive ? "Active" : "Expired"}
${cert.credentialUrl ? `- Verify at: ${cert.credentialUrl}` : ""}
`
  )
  .join("\n")}

These certifications demonstrate expertise in cloud architecture, AI/ML solutions, and enterprise technologies.
    `.trim();

    chunks.push({
      content: certsContent,
      section: "certifications",
      heading: "Professional Certifications",
    });

    allCerts.forEach((c) => console.log(`  ✓ ${c.name}`));
  }

  // 4. Sync Skills
  console.log("\n🛠️ Processing Skills...");
  const allSkills = await db.select().from(skills);

  if (allSkills.length > 0) {
    // Group skills by category
    const skillsByCategory = allSkills.reduce(
      (acc, skill) => {
        if (!acc[skill.category]) {
          acc[skill.category] = [];
        }
        acc[skill.category].push(skill);
        return acc;
      },
      {} as Record<string, typeof allSkills>
    );

    const skillsContent = `
Technical Skills and Expertise:

${Object.entries(skillsByCategory)
  .map(
    ([category, categorySkills]) => `
${category}:
${categorySkills
  .map(
    (s) =>
      `- ${s.name}${s.yearsExperience ? ` (${s.yearsExperience}+ years)` : ""}${s.proficiency ? ` - Proficiency: ${s.proficiency}%` : ""}`
  )
  .join("\n")}
`
  )
  .join("\n")}
    `.trim();

    chunks.push({
      content: skillsContent,
      section: "skills",
      heading: "Technical Skills",
    });

    console.log(`  ✓ ${allSkills.length} skills across ${Object.keys(skillsByCategory).length} categories`);
  }

  // 5. Add a comprehensive summary chunk
  console.log("\n📝 Creating summary chunk...");
  const summaryContent = `
Bharadwaz Kari - Professional Summary

Current Role: Enterprise Support Lead at Amazon Web Services (AWS)
Location: Atlanta, Georgia, USA
Experience: 15+ years in IT and cloud technologies

Key Highlights:
- Enterprise Support Lead at AWS achieving 98% CSAT scores
- Developed GenAI applications increasing productivity by 50% for 100+ practitioners
- Mentored 12+ Technical Account Managers
- Gold status in AWS Security community
- AWS Certified Solutions Architect - Professional
- AWS Certified AI Practitioner

Areas of Expertise:
- Cloud Architecture (AWS, Azure, GCP)
- Generative AI and Agentic AI
- Cloud Security and Well-Architected Framework
- Technical Account Management
- Enterprise Application Development (Java, Python, JavaScript)
- CRM/ERP Systems (Oracle JD Edwards, Microsoft Dynamics)

Portfolio Projects: ${allProjects.map((p) => p.title).join(", ")}

Contact: Based in Atlanta, Georgia. Available for enterprise cloud architecture, GenAI solutions, and technical leadership roles.
  `.trim();

  chunks.push({
    content: summaryContent,
    section: "summary",
    heading: "Professional Summary",
  });
  console.log("  ✓ Professional Summary");

  // Generate embeddings and insert chunks
  console.log(`\n🧠 Generating embeddings for ${chunks.length} chunks...`);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    console.log(`  [${i + 1}/${chunks.length}] ${chunk.heading}...`);

    const embedding = await generateEmbedding(chunk.content);

    await db.insert(documentChunks).values({
      documentId: docId,
      chunkIndex: i,
      content: chunk.content,
      tokenCount: Math.ceil(chunk.content.length / 4),
      embedding,
      metadata: {
        section: chunk.section,
        heading: chunk.heading,
      },
    });
  }

  // Update document chunk count
  await sql`UPDATE documents SET chunk_count = ${chunks.length} WHERE id = ${docId}`;

  console.log("\n✅ RAG sync complete!");
  console.log(`   Document ID: ${docId}`);
  console.log(`   Total chunks: ${chunks.length}`);
  console.log(`   - Projects: ${allProjects.length}`);
  console.log(`   - Experiences: ${allExperiences.length}`);
  console.log(`   - Certifications: ${allCerts.length > 0 ? 1 : 0} (combined)`);
  console.log(`   - Skills: ${allSkills.length > 0 ? 1 : 0} (combined)`);
  console.log(`   - Summary: 1`);
}

// Run the sync
syncRAGData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Sync failed:", error);
    process.exit(1);
  });
