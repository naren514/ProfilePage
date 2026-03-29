import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isUnauthorizedResponse } from "@/lib/auth/server-auth";

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

async function fetchPageSnippet(url: string): Promise<string> {
  async function fetchAndClean(targetUrl: string): Promise<string> {
    const res = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ProfilePageParser/1.0)",
      },
      cache: "no-store",
    });

    if (!res.ok) return "";

    const html = await res.text();
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 20000);
  }

  try {
    // Primary fetch
    let text = await fetchAndClean(url);

    // LinkedIn and some sites block direct scraping. Try Jina AI reader mirror fallback.
    if (text.length < 300) {
      const mirrorUrl = `https://r.jina.ai/http://${url.replace(/^https?:\/\//i, "")}`;
      const mirrored = await fetchAndClean(mirrorUrl);
      if (mirrored.length > text.length) text = mirrored;
    }

    return text;
  } catch {
    return "";
  }
}

function buildExtractionPrompt(url: string, extractedText: string, extractionType: string): string {
  const focus = extractionType === "experience"
    ? "Focus primarily on work experience details."
    : extractionType === "skills"
      ? "Focus primarily on skills and technologies."
      : extractionType === "certifications"
        ? "Focus primarily on certifications and credentials."
        : "Extract all available sections thoroughly.";

  return `You are an expert at extracting professional profile information.

Profile URL: ${url}

Extracted page text (may be partial):
${extractedText || "No direct content could be fetched from URL. Use only what can be inferred safely from the URL itself."}

Return ONLY valid JSON with this exact structure:
{
  "name": "",
  "headline": "",
  "summary": "",
  "location": "",
  "experiences": [{
    "company": "",
    "title": "",
    "location": "",
    "employmentType": "",
    "startDate": "",
    "endDate": "",
    "isCurrent": false,
    "description": "",
    "achievements": [""],
    "technologies": [""]
  }],
  "projects": [{
    "title": "",
    "summary": "",
    "description": "",
    "technologies": [""],
    "company": "",
    "role": "",
    "url": ""
  }],
  "certifications": [{
    "name": "",
    "issuer": "",
    "issueDate": "",
    "expirationDate": "",
    "credentialId": "",
    "credentialUrl": ""
  }],
  "skills": [{
    "name": "",
    "category": "",
    "proficiency": 80
  }],
  "volunteerWork": [{
    "organization": "",
    "role": "",
    "location": "",
    "cause": "",
    "description": "",
    "startDate": "",
    "endDate": "",
    "isCurrent": false
  }],
  "education": [{
    "school": "",
    "degree": "",
    "field": "",
    "startDate": "",
    "endDate": ""
  }]
}

Rules:
1) Do not invent facts. If unknown, use null/empty arrays.
2) Dates: YYYY-MM if known, otherwise YYYY.
3) Output JSON only. No markdown.
4) ${focus}`;
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (isUnauthorizedResponse(authResult)) return authResult;

    const { url, rawText, extractionType = "full" } = await request.json();

    const hasRawText = typeof rawText === "string" && rawText.trim().length > 0;
    const hasUrl = typeof url === "string" && url.trim().length > 0;

    if (!hasRawText && !hasUrl) {
      return NextResponse.json({ error: "Provide either URL or rawText" }, { status: 400 });
    }

    const normalizedUrl = hasUrl
      ? (/^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`)
      : "uploaded-file://local";

    if (hasUrl) {
      try {
        new URL(normalizedUrl);
      } catch {
        return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
      }
    }

    const openAiKey = process.env.OPENAI_API_KEY;
    if (!openAiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured. Add it to .env.local and restart." },
        { status: 500 }
      );
    }

    const extractedText = hasRawText ? rawText.trim().slice(0, 50000) : await fetchPageSnippet(normalizedUrl);

    if (extractedText.length < 200) {
      return NextResponse.json(
        {
          error:
            hasRawText
              ? "The uploaded text is too short to extract a profile. Try a fuller resume/profile document."
              : "Could not extract enough public content from this URL. LinkedIn often blocks scraping. Try a public profile URL, resume PDF, personal site, or paste profile text manually.",
        },
        { status: 422 }
      );
    }

    const prompt = buildExtractionPrompt(normalizedUrl, extractedText, extractionType);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_PROFILE_MODEL || "gpt-4o-mini",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You extract structured professional profile data and return strict JSON." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json({ error: `OpenAI request failed: ${text}` }, { status: 500 });
    }

    const data = await response.json();
    const responseText = data?.choices?.[0]?.message?.content || "{}";

    let profile: ParsedProfile;
    try {
      profile = JSON.parse(responseText);
      profile.experiences = profile.experiences || [];
      profile.projects = profile.projects || [];
      profile.certifications = profile.certifications || [];
      profile.skills = profile.skills || [];
      profile.volunteerWork = profile.volunteerWork || [];
    } catch {
      return NextResponse.json(
        { error: "Failed to parse profile data", rawData: String(responseText).slice(0, 2000) },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      profile,
      sourceUrl: normalizedUrl,
      sourceType: "website",
      groundingSearches: [],
      groundingSources: [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Failed to parse profile: ${message}` }, { status: 500 });
  }
}
