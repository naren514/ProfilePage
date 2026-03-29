import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isUnauthorizedResponse } from "@/lib/auth/server-auth";

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

async function fetchPageSnippet(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ProfilePageWebsiteAnalyzer/1.0)" },
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
      .slice(0, 18000);
  } catch {
    return "";
  }
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

    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    const openAiKey = process.env.OPENAI_API_KEY;
    if (!openAiKey) {
      return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 500 });
    }

    const pageText = await fetchPageSnippet(url);
    const prompt = `Analyze this website and return JSON only.\n\nURL: ${url}\n\nExtracted content:\n${pageText || "No page content available"}\n\nReturn object:\n{\n  "title": "",\n  "summary": "",\n  "description": "",\n  "technologies": [],\n  "features": [],\n  "targetAudience": "",\n  "category": ""\n}\n\nRules: do not invent specific facts not present. Keep concise and useful.`;

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini",
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You analyze websites and output strict JSON." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!aiRes.ok) {
      return NextResponse.json({ error: `OpenAI request failed: ${await aiRes.text()}` }, { status: 500 });
    }

    const aiJson = await aiRes.json();
    const responseText = aiJson?.choices?.[0]?.message?.content || "{}";

    let analysis: WebsiteAnalysis;
    try {
      analysis = JSON.parse(responseText);
    } catch {
      return NextResponse.json({ error: "Failed to parse analysis results" }, { status: 500 });
    }

    const thumbnailUrl = `https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot=true&meta=false&embed=screenshot.url`;
    const domain = new URL(url).hostname;
    const fallbackThumbnail = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;

    return NextResponse.json({
      ...analysis,
      url,
      thumbnailUrl,
      faviconUrl: fallbackThumbnail,
    });
  } catch (error) {
    console.error("Website analysis error:", error);
    return NextResponse.json({ error: "Failed to analyze website" }, { status: 500 });
  }
}
