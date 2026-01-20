import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isUnauthorizedResponse } from "@/lib/firebase/server-auth";
import { GoogleGenerativeAI, Tool } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Google Search tool - use type assertion as SDK types may not include latest features
const googleSearchTool = { googleSearch: {} } as Tool;

interface WebsiteAnalysis {
  title: string;
  summary: string;
  description: string;
  technologies: string[];
  features: string[];
  targetAudience: string;
  category: string;
  thumbnailUrl?: string;
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (isUnauthorizedResponse(authResult)) {
      return authResult;
    }

    const { url } = await request.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    // Use Gemini 2.5 Flash with Google Search grounding
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2048,
      },
    });

    const prompt = `Analyze the web application at ${url} and provide detailed information.

Search the web to find information about this website/application and return a JSON object with the following structure:
{
  "title": "The name/title of the web application",
  "summary": "A one-line summary of what the application does",
  "description": "A detailed 2-3 sentence description of the application, its purpose, and main functionality",
  "technologies": ["List of technologies, frameworks, or platforms the site likely uses"],
  "features": ["Key features or capabilities of the application"],
  "targetAudience": "Who the application is designed for",
  "category": "The category/type of application (e.g., E-commerce, SaaS, Portfolio, Social Media, etc.)"
}

Return ONLY the JSON object, no additional text or markdown formatting.`;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      tools: [googleSearchTool],
    });

    const responseText = result.response.text();

    // Parse the JSON response
    let analysis: WebsiteAnalysis;
    try {
      // Clean up the response if it has markdown code blocks
      const cleanedResponse = responseText
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      analysis = JSON.parse(cleanedResponse);
    } catch {
      console.error("Failed to parse Gemini response:", responseText);
      return NextResponse.json(
        { error: "Failed to parse analysis results" },
        { status: 500 }
      );
    }

    // Generate thumbnail URL using a screenshot service
    // Using microlink.io which provides free screenshot API
    const thumbnailUrl = `https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot=true&meta=false&embed=screenshot.url`;

    // Alternatively, try to get the favicon/og:image from the URL
    const domain = new URL(url).hostname;
    const fallbackThumbnail = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;

    return NextResponse.json({
      ...analysis,
      url,
      thumbnailUrl: thumbnailUrl,
      faviconUrl: fallbackThumbnail,
    });
  } catch (error) {
    console.error("Website analysis error:", error);
    return NextResponse.json(
      { error: "Failed to analyze website" },
      { status: 500 }
    );
  }
}
