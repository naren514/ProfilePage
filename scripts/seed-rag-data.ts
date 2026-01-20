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

// Resume content organized by sections
const resumeContent = {
  summary: `Bharadwaz Kari is a Senior Solutions Architect and Enterprise Support Lead at Amazon Web Services (AWS) with over 15 years of IT experience. He specializes in cloud architecture, enterprise solutions, security, and AI/GenAI implementations. Based in Atlanta, Georgia, he has a proven track record of delivering high-impact solutions that drive business value.

Key highlights:
- 15+ years of IT experience spanning enterprise systems, cloud architecture, and application development
- Currently Enterprise Support Lead at AWS, achieving 98% CSAT scores
- Expert in AWS services, cloud security, and Well-Architected Framework
- Developed GenAI applications that increased productivity by 50% for 100+ practitioners
- AWS Certified Solutions Architect – Professional and AWS Certified AI Practitioner`,

  currentRole: `Enterprise Support Lead at Amazon Web Services (AWS)
Location: Atlanta, Georgia | June 2024 - Present

Responsibilities and Achievements:
- Oversee enterprise customer portfolios, achieving 98% CSAT and reducing operational downtime by ~120 hours annually through cloud optimizations
- Drive North America-wide initiatives to enhance security incident response, decreasing resolution times
- Mentor and onboard 12 Technical Account Managers, reducing ramp-up time by ~2 weeks
- Spearhead AI-based automation in security incident response, saving ~15 hours per engagement
- Developed a secure, scalable GenAI application, increasing productivity by 50% for 100+ practitioners
- Created gamified incident-response exercises at AWS re:Invent, generating 350+ customer and partner leads
- Delivered 10+ GenAI enablement sessions for TAMs, recognised for highest contributions in the vertical
- Maintained Gold status in the Security community, fulfilling 40+ specialist requests in 9 months

Technologies: AWS, GenAI, Cloud Security, Well-Architected Framework, Incident Response`,

  previousAWSRoles: `Senior Technical Account Manager at AWS (April 2024 - June 2024)
- Developed strategic customer roadmaps, enhancing AWS service adoption and driving 30 additional quarterly engagements
- Elevated average customer security scores by 10 points across 12 clients through Well-Architected Reviews
- Created tailored roadmaps, increasing service adoption
- Enhanced customer security scores through comprehensive reviews

Technical Account Manager at AWS (May 2022 - April 2024)
- Oversaw technical account management initiatives, ensuring timely deployment of 10+ large cloud projects within 18 months
- Cultivated strong relationships, maintaining satisfaction levels with 90% of assigned accounts
- Drove project success through effective coordination and communication
- Enhanced customer engagement by providing tailored support and solutions

Technologies: AWS, Well-Architected Reviews, Cloud Security, Strategic Planning, Cloud Architecture, Project Management`,

  praxairExperience: `IT Application Manager at Praxair, Inc – a Linde Company (October 2021 - May 2022)
Location: Danbury, Connecticut
- Spearheaded transition from Oracle CRM to Microsoft Dynamics, achieving $80,000 in cost savings
- Developed a migration strategy for e-commerce platform to Azure
- Drove successful data migration, minimising costs significantly
- Crafted comprehensive migration plan for e-commerce application
Technologies: Microsoft Dynamics, Oracle CRM, Azure, Data Migration, E-commerce

IT Business Specialist & Application Developer at Praxair (July 2014 - October 2021)
- Developed web applications integrated with Oracle JD Edwards, enhancing user experience and reducing process time by 20%
- Implemented CRM On Demand for three business units, replicating the solution across the organization
- Spearheaded web application development to streamline processes
- Championed CRM solution implementation for multiple business units
Technologies: Oracle JD Edwards, CRM On Demand, Java, Web Development, ERP`,

  infosysExperience: `Senior Systems Analyst & Engineer at Infosys (June 2009 - July 2014)
Location: India / USA
- Oversaw modernization of Kraft's systems by rewriting four modules from mainframes to Java
- Managed Java-based Oracle Transportation Manager systems, enhancing overall application performance
- Conducted team training sessions to improve technical skills
- Spearheaded transition of legacy modules to modern Java architecture
- Optimised performance of Oracle Transportation Manager systems
Technologies: Java, Oracle Transportation Manager, Mainframe Migration, System Modernization`,

  certifications: `AWS Certifications:
- AWS Certified AI Practitioner (2024 - 2027)
- AWS Certified Solutions Architect – Professional (2023 - 2026)

These certifications demonstrate deep expertise in AWS cloud architecture and AI/ML solutions, validating the ability to design and deploy complex cloud solutions.`,

  skills: `Technical Skills:

Cloud Platforms:
- Amazon Web Services (AWS) - Expert level
- Microsoft Azure - Proficient
- Cloud Architecture and Design

Programming & Development:
- Java
- Web Development
- API Development
- Application Integration

Enterprise Systems:
- Oracle JD Edwards
- Oracle Transportation Manager
- Microsoft Dynamics CRM
- Oracle CRM On Demand

Security:
- Cloud Security
- Security Incident Response
- Well-Architected Framework
- Security Reviews and Assessments

AI & Automation:
- GenAI Applications
- AI-based Automation
- Machine Learning Integration

Other:
- Data Migration
- E-commerce Platforms
- Project Management
- Customer Success
- Technical Account Management`,

  contact: `Contact Information:
Name: Bharadwaz Kari
Location: Atlanta, Georgia, USA
Current Role: Enterprise Support Lead at AWS
Email: Available upon request
LinkedIn: Available for professional networking`,
};

async function seedRAGData() {
  console.log("Creating document entry...");

  // Create document entry
  const docId = uuidv4();
  await db.insert(documents).values({
    id: docId,
    filename: "bharadwaz_kari_resume.txt",
    originalName: "Bharadwaz Kari Resume",
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
