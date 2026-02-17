import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isUnauthorizedResponse } from "@/lib/auth/server-auth";
import { GoogleGenerativeAI, Tool } from "@google/generative-ai";

// Google Search tool for live web grounding
const googleSearchTool = { googleSearch: {} } as Tool;

export interface ParsedExperience {
  company: string;
  title: string;
  location?: string;
  employmentType?: string;
  startDate?: string;
  endDate?: string;
  isCurrent: boolean;
  description?: string;
  achievements?: string[];
  technologies?: string[];
}

export interface ParsedProject {
  title: string;
  summary: string;
  description?: string;
  technologies?: string[];
  company?: string;
  role?: string;
  url?: string;
}

export interface ParsedCertification {
  name: string;
  issuer: string;
  issueDate?: string;
  expirationDate?: string;
  credentialId?: string;
  credentialUrl?: string;
}

export interface ParsedSkill {
  name: string;
  category: string;
  proficiency?: number;
}

export interface ParsedVolunteer {
  organization: string;
  role: string;
  location?: string;
  cause?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  isCurrent: boolean;
}

export interface ParsedProfile {
  name?: string;
  headline?: string;
  summary?: string;
  location?: string;
  experiences: ParsedExperience[];
  projects: ParsedProject[];
  certifications: ParsedCertification[];
  skills: ParsedSkill[];
  volunteerWork: ParsedVolunteer[];
  education?: Array<{
    school: string;
    degree: string;
    field?: string;
    startDate?: string;
    endDate?: string;
  }>;
  rawData?: string;
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (isUnauthorizedResponse(authResult)) {
      return authResult;
    }

    const { url, extractionType = "full" } = await request.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
    }

    // Detect URL type
    const isLinkedIn = parsedUrl.hostname.includes("linkedin.com");
    const isGitHub = parsedUrl.hostname.includes("github.com");

    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not configured. Add it to .env.local and restart the server." },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(geminiApiKey);

    // Use Gemini 2.5 Flash with Google Search grounding for live data
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        temperature: 0.2, // Lower temperature for more factual extraction
        maxOutputTokens: 8192,
      },
    });

    const extractionPrompt = buildExtractionPrompt(url, isLinkedIn, isGitHub, extractionType);

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: extractionPrompt }] }],
      tools: [googleSearchTool],
    });

    const responseText = result.response.text();

    // Parse the JSON response
    let profile: ParsedProfile;
    try {
      // Clean up the response if it has markdown code blocks
      const cleanedResponse = responseText
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();

      // Find the JSON object in the response
      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }

      profile = JSON.parse(jsonMatch[0]);

      // Ensure all arrays exist
      profile.experiences = profile.experiences || [];
      profile.projects = profile.projects || [];
      profile.certifications = profile.certifications || [];
      profile.skills = profile.skills || [];
      profile.volunteerWork = profile.volunteerWork || [];

    } catch {
      console.error("Failed to parse profile response:", responseText);
      return NextResponse.json(
        {
          error: "Failed to parse profile data",
          rawData: responseText.substring(0, 2000)
        },
        { status: 500 }
      );
    }

    // Get grounding metadata if available
    const groundingMetadata = result.response.candidates?.[0]?.groundingMetadata;

    return NextResponse.json({
      success: true,
      profile,
      sourceUrl: url,
      sourceType: isLinkedIn ? "linkedin" : isGitHub ? "github" : "website",
      groundingSearches: groundingMetadata?.webSearchQueries || [],
      groundingSources: groundingMetadata?.groundingChunks?.map((chunk: { web?: { uri?: string; title?: string } }) => ({
        url: chunk.web?.uri,
        title: chunk.web?.title,
      })) || [],
    });

  } catch (error) {
    console.error("Profile parsing error:", error);

    const message = error instanceof Error ? error.message : "Unknown error";
    const lower = message.toLowerCase();

    if (lower.includes("api key") || lower.includes("authentication") || lower.includes("permission")) {
      return NextResponse.json(
        { error: "Profile parsing failed: Gemini API key is invalid or lacks permission." },
        { status: 500 }
      );
    }

    if (lower.includes("quota") || lower.includes("rate") || lower.includes("429")) {
      return NextResponse.json(
        { error: "Profile parsing failed: Gemini quota/rate limit reached. Try again shortly." },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: `Failed to parse profile: ${message}` },
      { status: 500 }
    );
  }
}

function buildExtractionPrompt(url: string, isLinkedIn: boolean, isGitHub: boolean, extractionType: string): string {
  const basePrompt = `You are an expert at extracting professional profile information from web sources.

I need you to search the web and find comprehensive information about the person whose profile is at: ${url}

${isLinkedIn ? `This is a LinkedIn profile. Search for information about this person including their work experience, education, skills, certifications, and projects. LinkedIn profiles often have detailed professional history.` : ""}

${isGitHub ? `This is a GitHub profile. Search for information about this developer including their repositories, contributions, technologies used, and any linked professional profiles.` : ""}

Search thoroughly and extract ALL available information. Return a JSON object with the following structure:

{
  "name": "Full name of the person",
  "headline": "Professional headline/title",
  "summary": "Professional summary/about section",
  "location": "Current location",
  "experiences": [
    {
      "company": "Company name",
      "title": "Job title",
      "location": "Job location (city, state/country)",
      "employmentType": "full-time/part-time/contract/freelance/internship",
      "startDate": "YYYY-MM format or YYYY",
      "endDate": "YYYY-MM format or YYYY or null if current",
      "isCurrent": true/false,
      "description": "Role description and responsibilities",
      "achievements": ["Achievement 1", "Achievement 2"],
      "technologies": ["Tech 1", "Tech 2"]
    }
  ],
  "projects": [
    {
      "title": "Project name",
      "summary": "Brief one-line summary",
      "description": "Detailed description",
      "technologies": ["Tech 1", "Tech 2"],
      "company": "Associated company if any",
      "role": "Role in the project",
      "url": "Project URL if available"
    }
  ],
  "certifications": [
    {
      "name": "Certification name",
      "issuer": "Issuing organization",
      "issueDate": "YYYY-MM format",
      "expirationDate": "YYYY-MM format or null if no expiration",
      "credentialId": "Credential ID if available",
      "credentialUrl": "Verification URL if available"
    }
  ],
  "skills": [
    {
      "name": "Skill name",
      "category": "Cloud/DevOps/Programming Language/Framework/Database/Tool/Platform/Soft Skill",
      "proficiency": 80
    }
  ],
  "volunteerWork": [
    {
      "organization": "Organization name",
      "role": "Role/position",
      "location": "Location",
      "cause": "Cause category (Education, Environment, etc.)",
      "description": "Description of volunteer work",
      "startDate": "YYYY-MM format",
      "endDate": "YYYY-MM format or null if current",
      "isCurrent": true/false
    }
  ],
  "education": [
    {
      "school": "Institution name",
      "degree": "Degree type (Bachelor's, Master's, etc.)",
      "field": "Field of study",
      "startDate": "YYYY",
      "endDate": "YYYY"
    }
  ]
}

IMPORTANT GUIDELINES:
1. Search the web thoroughly to find as much information as possible
2. For dates, use YYYY-MM format when month is known, otherwise just YYYY
3. For skills, assign proficiency based on years of experience and prominence (60-100 scale)
4. If information is not available, use null or empty arrays - don't make up data
5. For technologies, be specific (e.g., "AWS Lambda" not just "AWS")
6. Extract achievements as specific, measurable accomplishments when available
7. Return ONLY the JSON object, no additional text

`;

  if (extractionType === "experience") {
    return basePrompt + "\nFocus primarily on extracting work experience information.";
  } else if (extractionType === "skills") {
    return basePrompt + "\nFocus primarily on extracting skills and technologies.";
  } else if (extractionType === "certifications") {
    return basePrompt + "\nFocus primarily on extracting certifications and credentials.";
  }

  return basePrompt;
}
