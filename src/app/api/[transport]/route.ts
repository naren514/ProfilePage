import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { db } from "@/lib/db";
import { experiences, projects, certifications, skills, stories, volunteerWork, siteSettings } from "@/lib/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { generateFitAssessment, generateEmbedding } from "@/lib/ai/gemini";

// MCP Server for Bharadwaz Kari's Portfolio
// Enables AI agents to query professional information

const handler = createMcpHandler(
  (server) => {
    // ========================================
    // TOOLS - Actions AI agents can perform
    // ========================================

    // Tool: Get Profile Summary
    server.registerTool(
      "get_profile_summary",
      {
        title: "Get Profile Summary",
        description: "Get a comprehensive summary of Bharadwaz Kari's professional profile including headline, summary, and key stats",
        inputSchema: {},
      },
      async () => {
        try {
          // Get profile settings
          const profileSettings = await db
            .select()
            .from(siteSettings)
            .where(eq(siteSettings.category, "profile"));

          // Get counts
          const [expCount] = await db.select({ count: sql<number>`count(*)` }).from(experiences);
          const [projCount] = await db.select({ count: sql<number>`count(*)` }).from(projects);
          const [certCount] = await db.select({ count: sql<number>`count(*)` }).from(certifications);
          const [skillCount] = await db.select({ count: sql<number>`count(*)` }).from(skills);

          // Build profile object from settings
          const profile: Record<string, unknown> = {
            name: "Bharadwaz Kari",
            headline: "Senior Cloud Architect & DevOps Leader",
            yearsOfExperience: "15+",
            stats: {
              experiences: Number(expCount?.count) || 0,
              projects: Number(projCount?.count) || 0,
              certifications: Number(certCount?.count) || 0,
              skills: Number(skillCount?.count) || 0,
            },
          };

          profileSettings.forEach((setting) => {
            profile[setting.key] = setting.value;
          });

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(profile, null, 2),
              },
            ],
          };
        } catch (error) {
          return {
            content: [{ type: "text", text: `Error fetching profile: ${error}` }],
            isError: true,
          };
        }
      }
    );

    // Tool: Search Experiences
    server.registerTool(
      "search_experiences",
      {
        title: "Search Work Experiences",
        description: "Search and filter Bharadwaz's work experiences by company, role, technology, or date range",
        inputSchema: {
          query: z.string().optional().describe("Search term to filter experiences (company, role, or description)"),
          technology: z.string().optional().describe("Filter by specific technology (e.g., 'AWS', 'Kubernetes')"),
          limit: z.number().int().min(1).max(20).default(10).describe("Maximum number of results to return"),
        },
      },
      async ({ query, technology, limit = 10 }) => {
        try {
          let experienceList = await db
            .select()
            .from(experiences)
            .orderBy(desc(experiences.isCurrent), desc(experiences.startDate))
            .limit(limit);

          // Filter by query if provided
          if (query) {
            const lowerQuery = query.toLowerCase();
            experienceList = experienceList.filter(
              (exp) =>
                exp.company.toLowerCase().includes(lowerQuery) ||
                exp.title.toLowerCase().includes(lowerQuery) ||
                (exp.description?.toLowerCase().includes(lowerQuery) ?? false)
            );
          }

          // Filter by technology if provided
          if (technology) {
            const lowerTech = technology.toLowerCase();
            experienceList = experienceList.filter((exp) =>
              exp.technologies?.some((t) => t.toLowerCase().includes(lowerTech))
            );
          }

          const formatted = experienceList.map((exp) => ({
            company: exp.company,
            title: exp.title,
            location: exp.location,
            employmentType: exp.employmentType,
            duration: `${exp.startDate} - ${exp.isCurrent ? "Present" : exp.endDate || "N/A"}`,
            isCurrent: exp.isCurrent,
            description: exp.description,
            achievements: exp.achievements,
            technologies: exp.technologies,
          }));

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ count: formatted.length, experiences: formatted }, null, 2),
              },
            ],
          };
        } catch (error) {
          return {
            content: [{ type: "text", text: `Error searching experiences: ${error}` }],
            isError: true,
          };
        }
      }
    );

    // Tool: Get Skills by Category
    server.registerTool(
      "get_skills",
      {
        title: "Get Skills",
        description: "Get Bharadwaz's technical and professional skills, optionally filtered by category",
        inputSchema: {
          category: z
            .string()
            .optional()
            .describe("Filter by category (e.g., 'Cloud', 'DevOps', 'Programming Language', 'Framework')"),
        },
      },
      async ({ category }) => {
        try {
          let skillsList = await db.select().from(skills).orderBy(desc(skills.proficiency));

          if (category) {
            const lowerCategory = category.toLowerCase();
            skillsList = skillsList.filter((s) => s.category.toLowerCase().includes(lowerCategory));
          }

          // Group by category
          const grouped = skillsList.reduce(
            (acc, skill) => {
              if (!acc[skill.category]) {
                acc[skill.category] = [];
              }
              acc[skill.category].push({
                name: skill.name,
                proficiency: skill.proficiency,
                yearsExperience: skill.yearsExperience,
              });
              return acc;
            },
            {} as Record<string, Array<{ name: string; proficiency: number | null; yearsExperience: number | null }>>
          );

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ totalSkills: skillsList.length, skillsByCategory: grouped }, null, 2),
              },
            ],
          };
        } catch (error) {
          return {
            content: [{ type: "text", text: `Error fetching skills: ${error}` }],
            isError: true,
          };
        }
      }
    );

    // Tool: Get Certifications
    server.registerTool(
      "get_certifications",
      {
        title: "Get Certifications",
        description: "Get Bharadwaz's professional certifications (AWS, etc.)",
        inputSchema: {
          activeOnly: z.boolean().default(true).describe("Only return active (non-expired) certifications"),
        },
      },
      async ({ activeOnly = true }) => {
        try {
          let certList = await db.select().from(certifications).orderBy(desc(certifications.issueDate));

          if (activeOnly) {
            certList = certList.filter((c) => c.isActive);
          }

          const formatted = certList.map((cert) => ({
            name: cert.name,
            issuer: cert.issuer,
            issueDate: cert.issueDate,
            expirationDate: cert.expirationDate,
            credentialId: cert.credentialId,
            credentialUrl: cert.credentialUrl,
            isActive: cert.isActive,
          }));

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ count: formatted.length, certifications: formatted }, null, 2),
              },
            ],
          };
        } catch (error) {
          return {
            content: [{ type: "text", text: `Error fetching certifications: ${error}` }],
            isError: true,
          };
        }
      }
    );

    // Tool: Get Projects
    server.registerTool(
      "get_projects",
      {
        title: "Get Projects",
        description: "Get Bharadwaz's portfolio projects with STAR format details",
        inputSchema: {
          technology: z.string().optional().describe("Filter by technology used"),
          featuredOnly: z.boolean().default(false).describe("Only return featured projects"),
          limit: z.number().int().min(1).max(20).default(10).describe("Maximum number of results"),
        },
      },
      async ({ technology, featuredOnly = false, limit = 10 }) => {
        try {
          let projectList = await db
            .select()
            .from(projects)
            .where(eq(projects.isPublished, true))
            .orderBy(desc(projects.isFeatured), desc(projects.startDate))
            .limit(limit);

          if (featuredOnly) {
            projectList = projectList.filter((p) => p.isFeatured);
          }

          if (technology) {
            const lowerTech = technology.toLowerCase();
            projectList = projectList.filter((p) =>
              p.technologies?.some((t) => t.toLowerCase().includes(lowerTech))
            );
          }

          const formatted = projectList.map((proj) => ({
            title: proj.title,
            summary: proj.summary,
            company: proj.company,
            role: proj.role,
            technologies: proj.technologies,
            isFeatured: proj.isFeatured,
            // STAR format
            situation: proj.situation,
            task: proj.task,
            action: proj.action,
            result: proj.result,
            lessonsLearned: proj.lessonsLearned,
          }));

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ count: formatted.length, projects: formatted }, null, 2),
              },
            ],
          };
        } catch (error) {
          return {
            content: [{ type: "text", text: `Error fetching projects: ${error}` }],
            isError: true,
          };
        }
      }
    );

    // Tool: Assess Job Fit
    server.registerTool(
      "assess_job_fit",
      {
        title: "Assess Job Fit",
        description:
          "Analyze how well Bharadwaz's profile matches a job description. Returns fit score, matching skills, gaps, and recommendations.",
        inputSchema: {
          jobDescription: z.string().min(50).describe("The full job description to assess fit against"),
          jobTitle: z.string().optional().describe("Job title for context"),
          company: z.string().optional().describe("Company name for context"),
        },
      },
      async ({ jobDescription, jobTitle, company }) => {
        try {
          // Get all relevant experience and skills for context
          const [allExperiences, allSkills, allCerts, allProjects] = await Promise.all([
            db.select().from(experiences).orderBy(desc(experiences.startDate)),
            db.select().from(skills),
            db.select().from(certifications).where(eq(certifications.isActive, true)),
            db.select().from(projects).where(eq(projects.isPublished, true)),
          ]);

          // Build context for AI assessment
          const context = `
WORK EXPERIENCE:
${allExperiences.map((e) => `- ${e.title} at ${e.company} (${e.startDate} - ${e.isCurrent ? "Present" : e.endDate}): ${e.description}. Technologies: ${e.technologies?.join(", ")}`).join("\n")}

SKILLS:
${allSkills.map((s) => `- ${s.name} (${s.category}): ${s.proficiency}% proficiency`).join("\n")}

CERTIFICATIONS:
${allCerts.map((c) => `- ${c.name} from ${c.issuer}`).join("\n")}

KEY PROJECTS:
${allProjects.slice(0, 5).map((p) => `- ${p.title}: ${p.summary}. Technologies: ${p.technologies?.join(", ")}`).join("\n")}
          `;

          const fullJobDescription = `${jobTitle ? `Job Title: ${jobTitle}\n` : ""}${company ? `Company: ${company}\n` : ""}\n${jobDescription}`;

          const assessment = await generateFitAssessment(fullJobDescription, context);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    jobTitle: jobTitle || "Not specified",
                    company: company || "Not specified",
                    assessment: {
                      overallFitScore: assessment.overallFitScore,
                      matchingSkills: assessment.matchingSkills,
                      gaps: assessment.gaps,
                      transferableSkills: assessment.transferableSkills,
                      recommendations: assessment.recommendations,
                      summary: assessment.summary,
                    },
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } catch (error) {
          return {
            content: [{ type: "text", text: `Error assessing job fit: ${error}` }],
            isError: true,
          };
        }
      }
    );

    // Tool: Get Professional Stories
    server.registerTool(
      "get_stories",
      {
        title: "Get Professional Stories",
        description: "Get Bharadwaz's professional stories and case studies in STAR format",
        inputSchema: {
          featuredOnly: z.boolean().default(false).describe("Only return featured stories"),
          limit: z.number().int().min(1).max(10).default(5).describe("Maximum number of stories"),
        },
      },
      async ({ featuredOnly = false, limit = 5 }) => {
        try {
          let storyList = await db
            .select()
            .from(stories)
            .where(eq(stories.isPublished, true))
            .orderBy(desc(stories.isFeatured), desc(stories.date))
            .limit(limit);

          if (featuredOnly) {
            storyList = storyList.filter((s) => s.isFeatured);
          }

          const formatted = storyList.map((story) => ({
            title: story.title,
            summary: story.summary,
            company: story.company,
            role: story.role,
            date: story.date,
            tags: story.tags,
            isFeatured: story.isFeatured,
            // STAR format
            situation: story.situation,
            task: story.task,
            action: story.action,
            result: story.result,
            lessonsLearned: story.lessonsLearned,
          }));

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ count: formatted.length, stories: formatted }, null, 2),
              },
            ],
          };
        } catch (error) {
          return {
            content: [{ type: "text", text: `Error fetching stories: ${error}` }],
            isError: true,
          };
        }
      }
    );

    // Tool: Get Volunteer Experience
    server.registerTool(
      "get_volunteer_experience",
      {
        title: "Get Volunteer Experience",
        description: "Get Bharadwaz's volunteer work and community contributions",
        inputSchema: {},
      },
      async () => {
        try {
          const volunteerList = await db
            .select()
            .from(volunteerWork)
            .where(eq(volunteerWork.isPublished, true))
            .orderBy(desc(volunteerWork.isCurrent), desc(volunteerWork.startDate));

          const formatted = volunteerList.map((vol) => ({
            organization: vol.organization,
            role: vol.role,
            location: vol.location,
            cause: vol.cause,
            description: vol.description,
            duration: `${vol.startDate} - ${vol.isCurrent ? "Present" : vol.endDate || "N/A"}`,
            isCurrent: vol.isCurrent,
            skills: vol.skills,
          }));

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ count: formatted.length, volunteerWork: formatted }, null, 2),
              },
            ],
          };
        } catch (error) {
          return {
            content: [{ type: "text", text: `Error fetching volunteer experience: ${error}` }],
            isError: true,
          };
        }
      }
    );

    // Tool: Semantic Search
    server.registerTool(
      "semantic_search",
      {
        title: "Semantic Search",
        description:
          "Search Bharadwaz's portfolio using natural language. Uses vector similarity to find relevant experiences, projects, and skills.",
        inputSchema: {
          query: z.string().min(3).describe("Natural language search query"),
          limit: z.number().int().min(1).max(10).default(5).describe("Maximum number of results"),
        },
      },
      async ({ query, limit = 5 }) => {
        try {
          // Generate embedding for the query
          const queryEmbedding = await generateEmbedding(query);

          // Search for similar content in document chunks
          const results = await db.execute(sql`
            SELECT
              content,
              metadata,
              1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::vector) as similarity
            FROM document_chunks
            WHERE embedding IS NOT NULL
            ORDER BY embedding <=> ${JSON.stringify(queryEmbedding)}::vector
            LIMIT ${limit}
          `);

          const formatted = (results.rows as Array<{ content: string; metadata: unknown; similarity: number }>).map((row) => ({
            content: row.content,
            metadata: row.metadata,
            relevanceScore: Math.round(Number(row.similarity) * 100) / 100,
          }));

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    query,
                    resultsCount: formatted.length,
                    results: formatted,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } catch (error) {
          return {
            content: [{ type: "text", text: `Error in semantic search: ${error}` }],
            isError: true,
          };
        }
      }
    );

    // ========================================
    // RESOURCES - Static data AI agents can read
    // ========================================

    // Resource: Resume/Profile
    server.registerResource(
      "profile",
      "portfolio://profile",
      {
        title: "Professional Profile",
        description: "Bharadwaz Kari's complete professional profile and resume summary",
        mimeType: "application/json",
      },
      async () => {
        const [allExperiences, allSkills, allCerts] = await Promise.all([
          db.select().from(experiences).orderBy(desc(experiences.startDate)),
          db.select().from(skills),
          db.select().from(certifications).where(eq(certifications.isActive, true)),
        ]);

        const profile = {
          name: "Bharadwaz Kari",
          headline: "Senior Cloud Architect & DevOps Leader",
          summary:
            "15+ years of IT experience specializing in cloud architecture, DevOps, and digital transformation. AWS certified professional with expertise in designing and implementing scalable, secure cloud solutions.",
          location: "United States",
          experienceYears: 15,
          currentRole: allExperiences.find((e) => e.isCurrent),
          topSkills: allSkills.slice(0, 10).map((s) => s.name),
          certifications: allCerts.map((c) => ({ name: c.name, issuer: c.issuer })),
          experienceCount: allExperiences.length,
        };

        return {
          contents: [
            {
              uri: "portfolio://profile",
              mimeType: "application/json",
              text: JSON.stringify(profile, null, 2),
            },
          ],
        };
      }
    );

    // Resource: Skills Matrix
    server.registerResource(
      "skills-matrix",
      "portfolio://skills",
      {
        title: "Skills Matrix",
        description: "Complete skills matrix with proficiency levels and categories",
        mimeType: "application/json",
      },
      async () => {
        const allSkills = await db.select().from(skills).orderBy(desc(skills.proficiency));

        const grouped = allSkills.reduce(
          (acc, skill) => {
            if (!acc[skill.category]) {
              acc[skill.category] = [];
            }
            acc[skill.category].push({
              name: skill.name,
              proficiency: skill.proficiency,
              yearsExperience: skill.yearsExperience,
            });
            return acc;
          },
          {} as Record<string, Array<{ name: string; proficiency: number | null; yearsExperience: number | null }>>
        );

        return {
          contents: [
            {
              uri: "portfolio://skills",
              mimeType: "application/json",
              text: JSON.stringify({ totalSkills: allSkills.length, byCategory: grouped }, null, 2),
            },
          ],
        };
      }
    );

    // Resource: Contact Information
    server.registerResource(
      "contact",
      "portfolio://contact",
      {
        title: "Contact Information",
        description: "Professional contact information and portfolio links",
        mimeType: "application/json",
      },
      async () => {
        return {
          contents: [
            {
              uri: "portfolio://contact",
              mimeType: "application/json",
              text: JSON.stringify(
                {
                  website: "https://bharadwazkari.com",
                  portfolio: "https://bharadwazkari.com",
                  chatInterface: "https://bharadwazkari.com/chat",
                  fitAssessment: "https://bharadwazkari.com/fit-check",
                  forRecruiters: "https://bharadwazkari.com/for-recruiters",
                },
                null,
                2
              ),
            },
          ],
        };
      }
    );

    // ========================================
    // PROMPTS - Reusable prompt templates
    // ========================================

    server.registerPrompt(
      "candidate-summary",
      {
        title: "Candidate Summary",
        description: "Generate a summary of Bharadwaz as a candidate for a specific role",
        argsSchema: {
          targetRole: z.string().describe("The role to summarize the candidate for"),
        },
      },
      ({ targetRole }) => ({
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Please provide a summary of why Bharadwaz Kari would be a strong candidate for the role of ${targetRole}. Use the available tools to gather relevant information about his experience, skills, and certifications, then synthesize a compelling candidate summary.`,
            },
          },
        ],
      })
    );

    server.registerPrompt(
      "technical-deep-dive",
      {
        title: "Technical Deep Dive",
        description: "Deep dive into Bharadwaz's experience with a specific technology",
        argsSchema: {
          technology: z.string().describe("The technology to deep dive into"),
        },
      },
      ({ technology }) => ({
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Please provide a detailed analysis of Bharadwaz Kari's experience with ${technology}. Search his experiences, projects, and skills to find all relevant information about his work with this technology.`,
            },
          },
        ],
      })
    );
  },
  {},
  {
    basePath: "/api",
    maxDuration: 60,
    verboseLogs: process.env.NODE_ENV === "development",
    // Disable SSE transport since we don't have Redis configured
    // This allows Streamable HTTP to work without Redis dependency
    disableSse: true,
  }
);

export { handler as GET, handler as POST, handler as DELETE };
