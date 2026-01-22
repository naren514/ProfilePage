import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { db } from "@/lib/db";
import { experiences, projects, certifications, skills, stories, volunteerWork, siteSettings } from "@/lib/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { generateFitAssessment, generateEmbedding } from "@/lib/ai/gemini";

// MCP Server for the portfolio owner's Portfolio
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
        description: "Get a comprehensive summary of the portfolio owner's professional profile including headline, summary, and key stats",
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
            name: "Portfolio Owner",
            headline: "Technology Professional",
            yearsOfExperience: "10+",
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

    // Tool: Get Full Profile (comprehensive single-call tool)
    server.registerTool(
      "get_full_profile",
      {
        title: "Get Full Profile",
        description:
          "Returns complete portfolio data in a single response. Ideal for comprehensive candidate evaluation. Includes profile summary, all work experiences, skills matrix, certifications, featured projects, and professional stories.",
        inputSchema: {
          includeAllProjects: z.boolean().default(false).describe("Include all projects (default: featured only)"),
          includeAllStories: z.boolean().default(false).describe("Include all stories (default: featured only)"),
        },
      },
      async ({ includeAllProjects = false, includeAllStories = false }) => {
        try {
          // Fetch all data in parallel
          const [
            profileSettings,
            allExperiences,
            allSkills,
            allCerts,
            allProjects,
            allStories,
            allVolunteer,
          ] = await Promise.all([
            db.select().from(siteSettings).where(eq(siteSettings.category, "profile")),
            db.select().from(experiences).orderBy(desc(experiences.isCurrent), desc(experiences.startDate)),
            db.select().from(skills).orderBy(desc(skills.proficiency)),
            db.select().from(certifications).where(eq(certifications.isActive, true)).orderBy(desc(certifications.issueDate)),
            db.select().from(projects).where(eq(projects.isPublished, true)).orderBy(desc(projects.isFeatured), desc(projects.startDate)),
            db.select().from(stories).where(eq(stories.isPublished, true)).orderBy(desc(stories.isFeatured), desc(stories.date)),
            db.select().from(volunteerWork).where(eq(volunteerWork.isPublished, true)).orderBy(desc(volunteerWork.isCurrent)),
          ]);

          // Build profile from settings
          const profile: Record<string, unknown> = {
            name: "Portfolio Owner",
            headline: "Technology Professional",
            yearsOfExperience: "10+",
          };
          profileSettings.forEach((setting) => {
            profile[setting.key] = setting.value;
          });

          // Group skills by category
          const skillsByCategory = allSkills.reduce(
            (acc, skill) => {
              if (!acc[skill.category]) acc[skill.category] = [];
              acc[skill.category].push({
                name: skill.name,
                proficiency: skill.proficiency,
                yearsExperience: skill.yearsExperience,
              });
              return acc;
            },
            {} as Record<string, Array<{ name: string; proficiency: number | null; yearsExperience: number | null }>>
          );

          // Filter projects/stories based on params
          const projectsToReturn = includeAllProjects ? allProjects : allProjects.filter((p) => p.isFeatured);
          const storiesToReturn = includeAllStories ? allStories : allStories.filter((s) => s.isFeatured);

          const fullProfile = {
            profile: {
              ...profile,
              currentRole: allExperiences.find((e) => e.isCurrent)
                ? {
                    title: allExperiences.find((e) => e.isCurrent)!.title,
                    company: allExperiences.find((e) => e.isCurrent)!.company,
                  }
                : null,
            },
            experiences: allExperiences.map((exp) => ({
              company: exp.company,
              title: exp.title,
              location: exp.location,
              employmentType: exp.employmentType,
              duration: `${exp.startDate} - ${exp.isCurrent ? "Present" : exp.endDate || "N/A"}`,
              isCurrent: exp.isCurrent,
              description: exp.description,
              achievements: exp.achievements,
              technologies: exp.technologies,
            })),
            skills: {
              totalCount: allSkills.length,
              byCategory: skillsByCategory,
            },
            certifications: allCerts.map((cert) => ({
              name: cert.name,
              issuer: cert.issuer,
              issueDate: cert.issueDate,
              expirationDate: cert.expirationDate,
              credentialId: cert.credentialId,
              credentialUrl: cert.credentialUrl,
            })),
            projects: projectsToReturn.map((proj) => ({
              title: proj.title,
              summary: proj.summary,
              company: proj.company,
              role: proj.role,
              technologies: proj.technologies,
              isFeatured: proj.isFeatured,
              situation: proj.situation,
              task: proj.task,
              action: proj.action,
              result: proj.result,
            })),
            stories: storiesToReturn.map((story) => ({
              title: story.title,
              summary: story.summary,
              company: story.company,
              role: story.role,
              tags: story.tags,
              isFeatured: story.isFeatured,
              situation: story.situation,
              task: story.task,
              action: story.action,
              result: story.result,
            })),
            volunteerWork: allVolunteer.map((vol) => ({
              organization: vol.organization,
              role: vol.role,
              cause: vol.cause,
              description: vol.description,
              duration: `${vol.startDate} - ${vol.isCurrent ? "Present" : vol.endDate || "N/A"}`,
              skills: vol.skills,
            })),
            _meta: {
              totalExperiences: allExperiences.length,
              totalSkills: allSkills.length,
              totalCertifications: allCerts.length,
              totalProjects: allProjects.length,
              totalStories: allStories.length,
              totalVolunteerWork: allVolunteer.length,
              generatedAt: new Date().toISOString(),
            },
          };

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(fullProfile, null, 2),
              },
            ],
          };
        } catch (error) {
          return {
            content: [{ type: "text", text: `Error fetching full profile: ${error}` }],
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
        description: "Search and filter the owner's work experiences by company, role, technology, or date range. Supports pagination.",
        inputSchema: {
          query: z.string().optional().describe("Search term to filter experiences (company, role, or description)"),
          company: z.string().optional().describe("Filter by specific company name"),
          technology: z.string().optional().describe("Filter by specific technology (e.g., 'AWS', 'Kubernetes')"),
          limit: z.number().int().min(1).max(20).default(10).describe("Maximum number of results to return"),
          offset: z.number().int().min(0).default(0).describe("Number of results to skip for pagination"),
        },
      },
      async ({ query, company, technology, limit = 10, offset = 0 }) => {
        try {
          // Fetch all experiences first for filtering and total count
          let allExperiences = await db
            .select()
            .from(experiences)
            .orderBy(desc(experiences.isCurrent), desc(experiences.startDate));

          // Filter by query if provided
          if (query) {
            const lowerQuery = query.toLowerCase();
            allExperiences = allExperiences.filter(
              (exp) =>
                exp.company.toLowerCase().includes(lowerQuery) ||
                exp.title.toLowerCase().includes(lowerQuery) ||
                (exp.description?.toLowerCase().includes(lowerQuery) ?? false)
            );
          }

          // Filter by company if provided
          if (company) {
            const lowerCompany = company.toLowerCase();
            allExperiences = allExperiences.filter((exp) =>
              exp.company.toLowerCase().includes(lowerCompany)
            );
          }

          // Filter by technology if provided
          if (technology) {
            const lowerTech = technology.toLowerCase();
            allExperiences = allExperiences.filter((exp) =>
              exp.technologies?.some((t) => t.toLowerCase().includes(lowerTech))
            );
          }

          const totalCount = allExperiences.length;
          const paginatedList = allExperiences.slice(offset, offset + limit);
          const hasMore = offset + limit < totalCount;

          const formatted = paginatedList.map((exp) => ({
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
                text: JSON.stringify({
                  count: formatted.length,
                  totalCount,
                  offset,
                  hasMore,
                  experiences: formatted,
                }, null, 2),
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
        description: "Get the owner's technical and professional skills, optionally filtered by category",
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
        description: "Get the owner's professional certifications (AWS, Google Cloud, etc.) with filtering options",
        inputSchema: {
          activeOnly: z.boolean().default(true).describe("Only return active (non-expired) certifications"),
          issuer: z.string().optional().describe("Filter by certification issuer (e.g., 'Amazon Web Services', 'Google Cloud')"),
          query: z.string().optional().describe("Search term to filter certifications by name"),
        },
      },
      async ({ activeOnly = true, issuer, query }) => {
        try {
          let certList = await db.select().from(certifications).orderBy(desc(certifications.issueDate));

          if (activeOnly) {
            certList = certList.filter((c) => c.isActive);
          }

          if (issuer) {
            const lowerIssuer = issuer.toLowerCase();
            certList = certList.filter((c) => c.issuer.toLowerCase().includes(lowerIssuer));
          }

          if (query) {
            const lowerQuery = query.toLowerCase();
            certList = certList.filter((c) => c.name.toLowerCase().includes(lowerQuery));
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
        description: "Get the owner's portfolio projects with STAR format details",
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
          "Analyze how well the owner's profile matches a job description. Returns fit score, matching skills, gaps, and recommendations.",
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
        description: "Get the owner's professional stories and case studies in STAR format",
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
        description: "Get the owner's volunteer work and community contributions",
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
          "Search the owner's portfolio using natural language. Uses vector similarity to find relevant experiences, projects, and skills. Supports pagination and relevance filtering.",
        inputSchema: {
          query: z.string().min(3).describe("Natural language search query"),
          limit: z.number().int().min(1).max(20).default(5).describe("Maximum number of results"),
          offset: z.number().int().min(0).default(0).describe("Number of results to skip for pagination"),
          minRelevanceScore: z.number().min(0).max(1).default(0.3).describe("Minimum relevance score (0-1) to include in results"),
        },
      },
      async ({ query, limit = 5, offset = 0, minRelevanceScore = 0.3 }) => {
        try {
          // Generate embedding for the query
          const queryEmbedding = await generateEmbedding(query);

          // Fetch more results to account for filtering and pagination
          const fetchLimit = (offset + limit) * 2 + 10;

          // Search for similar content in document chunks
          const results = await db.execute(sql`
            SELECT
              content,
              metadata,
              1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::vector) as similarity
            FROM document_chunks
            WHERE embedding IS NOT NULL
            ORDER BY embedding <=> ${JSON.stringify(queryEmbedding)}::vector
            LIMIT ${fetchLimit}
          `);

          // Filter by minimum relevance score
          const allResults = (results.rows as Array<{ content: string; metadata: unknown; similarity: number }>)
            .filter((row) => Number(row.similarity) >= minRelevanceScore);

          const totalCount = allResults.length;
          const paginatedResults = allResults.slice(offset, offset + limit);
          const hasMore = offset + limit < totalCount;

          const formatted = paginatedResults.map((row) => ({
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
                    totalCount,
                    offset,
                    hasMore,
                    minRelevanceScore,
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
        description: "Complete professional profile and resume summary",
        mimeType: "application/json",
      },
      async () => {
        const [allExperiences, allSkills, allCerts] = await Promise.all([
          db.select().from(experiences).orderBy(desc(experiences.startDate)),
          db.select().from(skills),
          db.select().from(certifications).where(eq(certifications.isActive, true)),
        ]);

        const profile = {
          name: "Portfolio Owner",
          headline: "Technology Professional",
          summary:
            "Experienced technology professional specializing in cloud architecture, software development, and digital transformation. Configure detailed profile via admin settings.",
          location: "Configure via settings",
          experienceYears: 10,
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
                  website: process.env.NEXT_PUBLIC_APP_URL || "https://yourdomain.com",
                  portfolio: process.env.NEXT_PUBLIC_APP_URL || "https://yourdomain.com",
                  chatInterface: `${process.env.NEXT_PUBLIC_APP_URL || "https://yourdomain.com"}/chat`,
                  fitAssessment: `${process.env.NEXT_PUBLIC_APP_URL || "https://yourdomain.com"}/fit-check`,
                  forRecruiters: `${process.env.NEXT_PUBLIC_APP_URL || "https://yourdomain.com"}/for-recruiters`,
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
        description: "Generate a summary of the portfolio owner as a candidate for a specific role",
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
              text: `Please provide a summary of why this candidate would be a strong fit for the role of ${targetRole}. Use the available tools to gather relevant information about their experience, skills, and certifications, then synthesize a compelling candidate summary.`,
            },
          },
        ],
      })
    );

    server.registerPrompt(
      "technical-deep-dive",
      {
        title: "Technical Deep Dive",
        description: "Deep dive into the owner's experience with a specific technology",
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
              text: `Please provide a detailed analysis of the candidate's experience with ${technology}. Search the experiences, projects, and skills to find all relevant information about their work with this technology.`,
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
