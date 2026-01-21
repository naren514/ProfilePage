import { config } from "dotenv";
import { resolve } from "path";

// Load env before anything else
config({ path: resolve(process.cwd(), ".env.local") });

// Now import modules that depend on env vars
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { documents, documentChunks } from "../src/lib/db/schema";
import { v4 as uuidv4 } from "uuid";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Gemini for embeddings
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const embeddings: number[][] = [];

  for (const text of texts) {
    const result = await embeddingModel.embedContent(text);
    embeddings.push(result.embedding.values);
  }

  return embeddings;
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not found in .env.local");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const db = drizzle(sql);

// Sample resume content - Replace with your own data
// This is example content to demonstrate the RAG system
const resumeContent = {
  summary: `[Your Name] is a Senior Software Engineer with over 10 years of experience in full-stack development and cloud architecture. Specializing in building scalable web applications and AI-powered solutions.

Key highlights:
- 10+ years of experience in software development
- Expert in modern web technologies and cloud platforms
- Passionate about AI/ML and automation
- Strong track record of delivering impactful projects

NOTE: Replace this sample content with your actual resume data.`,

  currentRole: `Senior Software Engineer at [Company Name]
Location: [City, State] | [Start Date] - Present

Responsibilities and Achievements:
- Lead development of key product features serving millions of users
- Architect scalable solutions using cloud-native technologies
- Mentor junior developers and conduct code reviews
- Implement CI/CD pipelines and DevOps best practices

Technologies: React, Node.js, TypeScript, AWS, PostgreSQL`,

  previousRoles: `Software Engineer at [Previous Company] ([Start] - [End])
- Developed and maintained web applications
- Collaborated with cross-functional teams
- Improved system performance by 40%

Junior Developer at [First Company] ([Start] - [End])
- Built features for customer-facing applications
- Participated in agile development processes
- Learned best practices from senior engineers

Technologies: JavaScript, Python, SQL, Git`,

  education: `Bachelor of Science in Computer Science
[University Name] - [Graduation Year]

Relevant coursework: Data Structures, Algorithms, Database Systems, Software Engineering`,

  certifications: `Professional Certifications:
- [Certification Name] ([Year])
- [Certification Name] ([Year])

These certifications demonstrate expertise in [relevant areas].`,

  skills: `Technical Skills:

Programming Languages:
- JavaScript/TypeScript - Expert
- Python - Proficient
- Java - Intermediate

Frameworks & Libraries:
- React, Next.js
- Node.js, Express
- Django, FastAPI

Cloud & DevOps:
- AWS (EC2, S3, Lambda, RDS)
- Docker, Kubernetes
- CI/CD (GitHub Actions, Jenkins)

Databases:
- PostgreSQL
- MongoDB
- Redis

Other:
- Git, GitHub
- Agile/Scrum
- Technical Writing`,

  contact: `Contact Information:
Name: [Your Name]
Location: [City, State, Country]
Current Role: [Your Current Title]
Email: Configure in Admin Settings
LinkedIn: Configure in Admin Settings

NOTE: Update contact info via the Admin Dashboard settings page.`,
};

async function seedRAGData() {
  console.log("Creating document entry...");

  // Create document entry
  const docId = uuidv4();
  await db.insert(documents).values({
    id: docId,
    filename: "professional_resume.txt",
    originalName: "Professional Resume",
    mimeType: "text/plain",
    fileSize: 0,
    storagePath: "seeded",
    category: "resume",
    isActive: true,
    processedAt: new Date(),
  });

  console.log("Document created:", docId);

  // Convert resume content to chunks
  const chunks = Object.entries(resumeContent).map(([section, content], index) => ({
    section,
    content,
    index,
  }));

  console.log(`\nGenerating embeddings for ${chunks.length} chunks...`);

  // Generate embeddings in batches
  const chunkTexts = chunks.map((c) => c.content);
  const embeddings = await generateEmbeddings(chunkTexts);

  console.log("Embeddings generated, inserting chunks...");

  // Insert chunks with embeddings
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const embedding = embeddings[i];

    await db.insert(documentChunks).values({
      documentId: docId,
      chunkIndex: chunk.index,
      content: chunk.content,
      tokenCount: Math.ceil(chunk.content.length / 4),
      embedding,
      metadata: {
        section: chunk.section,
        heading: chunk.section.replace(/([A-Z])/g, " $1").trim(),
      },
    });

    console.log(`  Inserted chunk ${i + 1}/${chunks.length}: ${chunk.section}`);
  }

  // Update document chunk count
  await sql`UPDATE documents SET chunk_count = ${chunks.length} WHERE id = ${docId}`;

  console.log("\nRAG data seeding complete!");
  console.log(`- Document ID: ${docId}`);
  console.log(`- Chunks created: ${chunks.length}`);
}

// Run the seed function
seedRAGData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Seeding failed:", error);
    process.exit(1);
  });
