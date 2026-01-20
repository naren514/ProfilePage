import { db } from "@/lib/db";
import {
  documents,
  documentChunks,
  projects,
  experiences,
  certifications,
  skills,
  stories,
  volunteerWork,
  type Project,
  type Experience,
  type Certification,
  type Skill,
  type Story,
  type VolunteerWork,
} from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { generateEmbedding } from "@/lib/ai/gemini";

// Document ID for synced portfolio content
const SYNC_DOCUMENT_FILENAME = "portfolio_sync.txt";

type EntityType = "project" | "experience" | "certification" | "skill" | "story" | "volunteer" | "summary";

interface ChunkMetadata {
  entityType: EntityType;
  entityId: string;
  section: string;
  heading: string;
}

// Get or create the sync document
async function getOrCreateSyncDocument(): Promise<string> {
  const existingDocs = await db
    .select()
    .from(documents)
    .where(eq(documents.filename, SYNC_DOCUMENT_FILENAME));

  if (existingDocs.length > 0) {
    return existingDocs[0].id;
  }

  const [newDoc] = await db
    .insert(documents)
    .values({
      filename: SYNC_DOCUMENT_FILENAME,
      originalName: "Portfolio Database Content",
      mimeType: "text/plain",
      fileSize: 0,
      storagePath: "synced",
      category: "portfolio",
      isActive: true,
      processedAt: new Date(),
    })
    .returning();

  return newDoc.id;
}

// Format project content for RAG - flexible format, not strictly STAR
function formatProjectContent(project: Project): string {
  const parts: string[] = [
    `Project: ${project.title}`,
    `Company: ${project.company || "Personal Project"}`,
    `Role: ${project.role || "Developer"}`,
  ];

  if (project.websiteUrl) {
    parts.push(`Website: ${project.websiteUrl}`);
  }

  parts.push("", `Summary: ${project.summary}`);

  // Include detailed description if available (combines situation, task, action, result naturally)
  const detailedDescription: string[] = [];
  if (project.situation) detailedDescription.push(project.situation);
  if (project.task) detailedDescription.push(project.task);
  if (project.action) detailedDescription.push(project.action);
  if (project.result) detailedDescription.push(project.result);

  if (detailedDescription.length > 0) {
    parts.push("", `Details: ${detailedDescription.join(" ")}`);
  }

  if (project.lessonsLearned) {
    parts.push("", `Key Learnings: ${project.lessonsLearned}`);
  }

  if (project.technologies.length > 0) {
    parts.push("", `Technologies Used: ${project.technologies.join(", ")}`);
  }

  if (project.startDate) {
    parts.push(`Timeline: ${project.startDate} to ${project.endDate || "Present"}`);
  }

  return parts.join("\n").trim();
}

// Format experience content for RAG - achievements in structured format
function formatExperienceContent(exp: Experience): string {
  const parts: string[] = [
    `Work Experience: ${exp.title}`,
    `Company: ${exp.company}`,
    `Location: ${exp.location || "Not specified"}`,
    `Employment Type: ${exp.employmentType}`,
    `Duration: ${exp.startDate} to ${exp.isCurrent ? "Present" : exp.endDate}`,
  ];

  if (exp.isCurrent) {
    parts.push("(Current Position)");
  }

  if (exp.description) {
    parts.push("", `Role Overview: ${exp.description}`);
  }

  // Format achievements with impact-focused structure
  if (exp.achievements && exp.achievements.length > 0) {
    parts.push("", "Key Achievements and Impact:");
    exp.achievements.forEach((achievement, index) => {
      // Each achievement should ideally follow: Action + Context + Result pattern
      parts.push(`${index + 1}. ${achievement}`);
    });
  }

  if (exp.technologies && exp.technologies.length > 0) {
    parts.push("", `Technologies & Tools: ${exp.technologies.join(", ")}`);
  }

  return parts.join("\n").trim();
}

// Format certification content for RAG
function formatCertificationContent(cert: Certification): string {
  return `
Certification: ${cert.name}
Issuer: ${cert.issuer}
Credential ID: ${cert.credentialId || "Not provided"}
Issued: ${cert.issueDate}
${cert.expirationDate ? `Expires: ${cert.expirationDate}` : "No Expiration"}
Status: ${cert.isActive ? "Active" : "Expired"}
${cert.credentialUrl ? `Verify at: ${cert.credentialUrl}` : ""}
  `.trim();
}

// Format skill content for RAG
function formatSkillContent(skill: Skill): string {
  return `
Skill: ${skill.name}
Category: ${skill.category}
${skill.yearsExperience ? `Experience: ${skill.yearsExperience}+ years` : ""}
${skill.proficiency ? `Proficiency: ${skill.proficiency}%` : ""}
  `.trim();
}

// Format story content for RAG - STAR format
function formatStoryContent(story: Story): string {
  const parts: string[] = [
    `Story: ${story.title}`,
    `Company: ${story.company || "Personal"}`,
    `Role: ${story.role || "Professional"}`,
  ];

  if (story.date) {
    parts.push(`Date: ${story.date}`);
  }

  parts.push("", `Summary: ${story.summary}`);

  // Include STAR format details if available
  if (story.situation) {
    parts.push("", `Situation: ${story.situation}`);
  }
  if (story.task) {
    parts.push(`Task: ${story.task}`);
  }
  if (story.action) {
    parts.push(`Action: ${story.action}`);
  }
  if (story.result) {
    parts.push(`Result: ${story.result}`);
  }

  if (story.lessonsLearned) {
    parts.push("", `Key Learnings: ${story.lessonsLearned}`);
  }

  if (story.tags && story.tags.length > 0) {
    parts.push("", `Tags: ${story.tags.join(", ")}`);
  }

  return parts.join("\n").trim();
}

// Format volunteer work content for RAG
function formatVolunteerContent(volunteer: VolunteerWork): string {
  const parts: string[] = [
    `Volunteer Work: ${volunteer.role}`,
    `Organization: ${volunteer.organization}`,
  ];

  if (volunteer.location) {
    parts.push(`Location: ${volunteer.location}`);
  }
  if (volunteer.cause) {
    parts.push(`Cause: ${volunteer.cause}`);
  }

  if (volunteer.startDate) {
    parts.push(`Duration: ${volunteer.startDate} to ${volunteer.isCurrent ? "Present" : volunteer.endDate || "N/A"}`);
  }

  if (volunteer.description) {
    parts.push("", `Description: ${volunteer.description}`);
  }

  // Include STAR format details if available
  if (volunteer.situation) {
    parts.push("", `Situation: ${volunteer.situation}`);
  }
  if (volunteer.task) {
    parts.push(`Task: ${volunteer.task}`);
  }
  if (volunteer.action) {
    parts.push(`Action: ${volunteer.action}`);
  }
  if (volunteer.result) {
    parts.push(`Result: ${volunteer.result}`);
  }

  if (volunteer.skills && volunteer.skills.length > 0) {
    parts.push("", `Skills Applied: ${volunteer.skills.join(", ")}`);
  }

  return parts.join("\n").trim();
}

// Sync a single entity to RAG
export async function syncEntityToRAG(
  entityType: EntityType,
  entity: Project | Experience | Certification | Skill | Story | VolunteerWork
): Promise<void> {
  const docId = await getOrCreateSyncDocument();

  let content: string;
  let heading: string;
  let section: string;

  switch (entityType) {
    case "project":
      content = formatProjectContent(entity as Project);
      heading = `Project: ${(entity as Project).title}`;
      section = "projects";
      break;
    case "experience":
      content = formatExperienceContent(entity as Experience);
      heading = `${(entity as Experience).title} at ${(entity as Experience).company}`;
      section = "experience";
      break;
    case "certification":
      content = formatCertificationContent(entity as Certification);
      heading = `Certification: ${(entity as Certification).name}`;
      section = "certifications";
      break;
    case "skill":
      content = formatSkillContent(entity as Skill);
      heading = `Skill: ${(entity as Skill).name}`;
      section = "skills";
      break;
    case "story":
      content = formatStoryContent(entity as Story);
      heading = `Story: ${(entity as Story).title}`;
      section = "stories";
      break;
    case "volunteer":
      content = formatVolunteerContent(entity as VolunteerWork);
      heading = `Volunteer: ${(entity as VolunteerWork).role} at ${(entity as VolunteerWork).organization}`;
      section = "volunteer";
      break;
    default:
      throw new Error(`Unknown entity type: ${entityType}`);
  }

  // Check if chunk already exists
  const existingChunks = await db.execute(sql`
    SELECT id FROM document_chunks
    WHERE document_id = ${docId}
    AND metadata->>'entityType' = ${entityType}
    AND metadata->>'entityId' = ${entity.id}
  `);

  // Generate new embedding
  const embedding = await generateEmbedding(content);

  const metadata: ChunkMetadata = {
    entityType,
    entityId: entity.id,
    section,
    heading,
  };

  if (existingChunks.rows.length > 0) {
    // Update existing chunk
    const chunkId = (existingChunks.rows[0] as { id: string }).id;
    await db
      .update(documentChunks)
      .set({
        content,
        tokenCount: Math.ceil(content.length / 4),
        embedding,
        metadata,
      })
      .where(eq(documentChunks.id, chunkId));
  } else {
    // Get the next chunk index
    const maxIndexResult = await db.execute(sql`
      SELECT COALESCE(MAX(chunk_index), -1) + 1 as next_index
      FROM document_chunks
      WHERE document_id = ${docId}
    `);
    const nextIndex = (maxIndexResult.rows[0] as { next_index: number }).next_index;

    // Insert new chunk
    await db.insert(documentChunks).values({
      documentId: docId,
      chunkIndex: nextIndex,
      content,
      tokenCount: Math.ceil(content.length / 4),
      embedding,
      metadata,
    });
  }

  // Update document chunk count
  await updateDocumentChunkCount(docId);
}

// Remove an entity from RAG
export async function removeEntityFromRAG(
  entityType: EntityType,
  entityId: string
): Promise<void> {
  const existingDocs = await db
    .select()
    .from(documents)
    .where(eq(documents.filename, SYNC_DOCUMENT_FILENAME));

  if (existingDocs.length === 0) {
    return; // No sync document exists
  }

  const docId = existingDocs[0].id;

  // Delete the chunk for this entity
  await db.execute(sql`
    DELETE FROM document_chunks
    WHERE document_id = ${docId}
    AND metadata->>'entityType' = ${entityType}
    AND metadata->>'entityId' = ${entityId}
  `);

  // Update document chunk count
  await updateDocumentChunkCount(docId);
}

// Update the chunk count on the document
async function updateDocumentChunkCount(docId: string): Promise<void> {
  const countResult = await db.execute(sql`
    SELECT COUNT(*) as count FROM document_chunks WHERE document_id = ${docId}
  `);
  const count = parseInt((countResult.rows[0] as { count: string }).count, 10);

  await db
    .update(documents)
    .set({ chunkCount: count })
    .where(eq(documents.id, docId));
}

// Sync all entities to RAG (full sync)
export async function fullRAGSync(): Promise<{
  projects: number;
  experiences: number;
  certifications: number;
  skills: number;
  stories: number;
  volunteer: number;
  summary: number;
}> {
  console.log("Starting full RAG sync...");

  const docId = await getOrCreateSyncDocument();

  // Clear existing synced chunks
  await db.delete(documentChunks).where(eq(documentChunks.documentId, docId));

  const stats = {
    projects: 0,
    experiences: 0,
    certifications: 0,
    skills: 0,
    stories: 0,
    volunteer: 0,
    summary: 0,
  };

  // Sync all projects
  const allProjects = await db.select().from(projects);
  for (const project of allProjects) {
    await syncEntityToRAG("project", project);
    stats.projects++;
    console.log(`  Synced project: ${project.title}`);
  }

  // Sync all experiences
  const allExperiences = await db.select().from(experiences);
  for (const exp of allExperiences) {
    await syncEntityToRAG("experience", exp);
    stats.experiences++;
    console.log(`  Synced experience: ${exp.title} at ${exp.company}`);
  }

  // Sync all certifications
  const allCerts = await db.select().from(certifications);
  for (const cert of allCerts) {
    await syncEntityToRAG("certification", cert);
    stats.certifications++;
    console.log(`  Synced certification: ${cert.name}`);
  }

  // Sync all skills
  const allSkills = await db.select().from(skills);
  for (const skill of allSkills) {
    await syncEntityToRAG("skill", skill);
    stats.skills++;
    console.log(`  Synced skill: ${skill.name}`);
  }

  // Sync all stories
  const allStories = await db.select().from(stories);
  for (const story of allStories) {
    await syncEntityToRAG("story", story);
    stats.stories++;
    console.log(`  Synced story: ${story.title}`);
  }

  // Sync all volunteer work
  const allVolunteer = await db.select().from(volunteerWork);
  for (const volunteer of allVolunteer) {
    await syncEntityToRAG("volunteer", volunteer);
    stats.volunteer++;
    console.log(`  Synced volunteer: ${volunteer.role} at ${volunteer.organization}`);
  }

  // Create professional summary
  await syncProfessionalSummary(docId, allProjects, allExperiences, allCerts, allSkills, allStories, allVolunteer);
  stats.summary = 1;

  console.log("Full RAG sync complete!");
  console.log(`  Projects: ${stats.projects}`);
  console.log(`  Experiences: ${stats.experiences}`);
  console.log(`  Certifications: ${stats.certifications}`);
  console.log(`  Skills: ${stats.skills}`);
  console.log(`  Stories: ${stats.stories}`);
  console.log(`  Volunteer: ${stats.volunteer}`);
  console.log(`  Summary: ${stats.summary}`);

  return stats;
}

// Sync the professional summary
async function syncProfessionalSummary(
  docId: string,
  allProjects: Project[],
  allExperiences: Experience[],
  allCerts: Certification[],
  allSkills: Skill[],
  allStories: Story[] = [],
  allVolunteer: VolunteerWork[] = []
): Promise<void> {
  const currentRole = allExperiences.find((e) => e.isCurrent);
  const yearsExperience = 15; // Could calculate from experiences

  const summaryContent = `
Bharadwaz Kari - Professional Summary

Current Role: ${currentRole ? `${currentRole.title} at ${currentRole.company}` : "Software Professional"}
Location: Atlanta, Georgia, USA
Experience: ${yearsExperience}+ years in IT and cloud technologies

Key Highlights:
${currentRole?.achievements?.slice(0, 5).map((a) => `- ${a}`).join("\n") || "- Various accomplishments"}

Areas of Expertise:
${Array.from(new Set(allSkills.map((s) => s.category))).slice(0, 6).map((c) => `- ${c}`).join("\n")}

Certifications:
${allCerts.filter((c) => c.isActive).map((c) => `- ${c.name}`).join("\n")}

Portfolio Projects: ${allProjects.map((p) => p.title).join(", ")}

${allStories.length > 0 ? `Professional Stories: ${allStories.map((s) => s.title).join(", ")}` : ""}

${allVolunteer.length > 0 ? `Volunteer Work: ${allVolunteer.map((v) => `${v.role} at ${v.organization}`).join(", ")}` : ""}

Contact: Based in Atlanta, Georgia. Available for enterprise cloud architecture, GenAI solutions, and technical leadership roles.
  `.trim();

  const embedding = await generateEmbedding(summaryContent);

  // Check if summary already exists
  const existingChunks = await db.execute(sql`
    SELECT id FROM document_chunks
    WHERE document_id = ${docId}
    AND metadata->>'entityType' = 'summary'
  `);

  const metadata: ChunkMetadata = {
    entityType: "summary",
    entityId: "professional-summary",
    section: "summary",
    heading: "Professional Summary",
  };

  if (existingChunks.rows.length > 0) {
    const chunkId = (existingChunks.rows[0] as { id: string }).id;
    await db
      .update(documentChunks)
      .set({
        content: summaryContent,
        tokenCount: Math.ceil(summaryContent.length / 4),
        embedding,
        metadata,
      })
      .where(eq(documentChunks.id, chunkId));
  } else {
    const maxIndexResult = await db.execute(sql`
      SELECT COALESCE(MAX(chunk_index), -1) + 1 as next_index
      FROM document_chunks
      WHERE document_id = ${docId}
    `);
    const nextIndex = (maxIndexResult.rows[0] as { next_index: number }).next_index;

    await db.insert(documentChunks).values({
      documentId: docId,
      chunkIndex: nextIndex,
      content: summaryContent,
      tokenCount: Math.ceil(summaryContent.length / 4),
      embedding,
      metadata,
    });
  }

  await updateDocumentChunkCount(docId);
}

// Regenerate the professional summary (call after any entity changes)
export async function regenerateProfessionalSummary(): Promise<void> {
  const docId = await getOrCreateSyncDocument();
  const allProjects = await db.select().from(projects);
  const allExperiences = await db.select().from(experiences);
  const allCerts = await db.select().from(certifications);
  const allSkills = await db.select().from(skills);
  const allStories = await db.select().from(stories);
  const allVolunteer = await db.select().from(volunteerWork);

  await syncProfessionalSummary(docId, allProjects, allExperiences, allCerts, allSkills, allStories, allVolunteer);
}
