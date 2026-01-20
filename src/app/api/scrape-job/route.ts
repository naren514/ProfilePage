import { NextRequest, NextResponse } from "next/server";
import { chatModel } from "@/lib/ai/gemini";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

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

    // Fetch the job posting page
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch URL: ${response.statusText}` },
        { status: 400 }
      );
    }

    const html = await response.text();

    // Extract text content from HTML and clean it
    const textContent = extractTextFromHtml(html);

    if (textContent.length < 100) {
      return NextResponse.json(
        { error: "Could not extract sufficient content from the URL" },
        { status: 400 }
      );
    }

    // Use AI to extract structured job information
    const extractedContent = await extractJobContent(textContent, parsedUrl.hostname);

    return NextResponse.json({ content: extractedContent });
  } catch (error) {
    console.error("Job scraper error:", error);
    return NextResponse.json(
      { error: "Failed to process job posting" },
      { status: 500 }
    );
  }
}

function extractTextFromHtml(html: string): string {
  // Remove script and style tags
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "");

  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, " ");

  // Decode HTML entities
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&bull;/g, "•");

  // Clean up whitespace
  text = text.replace(/\s+/g, " ").trim();

  // Truncate if too long (to stay within token limits)
  if (text.length > 15000) {
    text = text.substring(0, 15000);
  }

  return text;
}

async function extractJobContent(rawContent: string, hostname: string): Promise<string> {
  const prompt = `You are a job posting parser. Extract the job description from the following raw text content scraped from ${hostname}.

Raw content:
${rawContent}

Extract and format the following information in a clear, structured way:
1. Job Title
2. Company Name
3. Location
4. Job Type (Full-time, Part-time, Contract, etc.)
5. Required Skills and Qualifications
6. Preferred/Nice-to-have Skills
7. Key Responsibilities
8. Requirements (years of experience, education, etc.)
9. Any other relevant job details

Format the output as a clean, readable job description. Remove any navigation elements, ads, or unrelated content. If certain information is not available, omit that section.

Output the extracted job description:`;

  try {
    const result = await chatModel.generateContent(prompt);
    const response = result.response.text();
    return response.trim();
  } catch (error) {
    console.error("AI extraction error:", error);
    // Fallback to basic extraction
    return rawContent.substring(0, 5000);
  }
}
