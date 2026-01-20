import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY environment variable is not set");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Chat model - Gemini 2.5 Flash (stable production model)
export const chatModel = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
  safetySettings: [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
  ],
});

// Embedding model - gemini-embedding-001 (3072 dimensions)
// Note: This is the latest Gemini embedding model, replacing text-embedding-004
export const embeddingModel = genAI.getGenerativeModel({
  model: "gemini-embedding-001",
});

// System prompt for the RAG chat - generic version
export const SYSTEM_PROMPT = `You are a professional portfolio assistant. Help recruiters and hiring managers learn about the portfolio owner's professional background.

Response style:
- Start with a brief 1-sentence intro that directly answers the question
- Use bullet points for lists (certifications, skills, projects)
- Add a brief closing line with relevance or context when appropriate
- Keep total response to 3-6 sentences for simple questions, longer for complex ones

Content rules:
- Only include facts from the provided context
- No filler phrases like "demonstrating expertise" or "showcasing mastery"
- No duplicate information
- Include the issuer/company when listing credentials or experience

Example good response for "What certifications do you have?":
"The portfolio owner holds these professional certifications:

- **AWS Solutions Architect – Professional** (Dec 2024 - Dec 2027)
- **Google Cloud Professional Architect** (Jan 2024 - Jan 2027)

These certifications validate expertise in cloud architecture and design."

Context from the portfolio is provided below.`;

// Generate embeddings for text
export async function generateEmbedding(text: string): Promise<number[]> {
  const result = await embeddingModel.embedContent(text);
  return result.embedding.values;
}

// Generate embeddings for multiple texts (batch)
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const embeddings: number[][] = [];

  // Process in batches of 5 to avoid rate limits
  const batchSize = 5;
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((text) => generateEmbedding(text))
    );
    embeddings.push(...batchResults);
  }

  return embeddings;
}

// Chat completion with RAG context
export async function generateChatResponse(
  userMessage: string,
  context: string,
  chatHistory: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }>
): Promise<string> {
  const chat = chatModel.startChat({
    history: [
      {
        role: "user",
        parts: [{ text: `System: ${SYSTEM_PROMPT}\n\nRelevant context from the portfolio:\n${context}` }],
      },
      {
        role: "model",
        parts: [{ text: "I understand. I'm ready to help answer questions about the professional background using the provided context. How can I assist you?" }],
      },
      ...chatHistory,
    ],
    generationConfig: {
      temperature: 0.5,
      topP: 0.9,
      topK: 40,
      maxOutputTokens: 1024,
    },
  });

  const result = await chat.sendMessage(userMessage);
  const response = result.response;
  return response.text();
}

// Stream chat response
export async function* streamChatResponse(
  userMessage: string,
  context: string,
  chatHistory: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }>
): AsyncGenerator<string, void, unknown> {
  const chat = chatModel.startChat({
    history: [
      {
        role: "user",
        parts: [{ text: `System: ${SYSTEM_PROMPT}\n\nRelevant context from the portfolio:\n${context}` }],
      },
      {
        role: "model",
        parts: [{ text: "I understand. I'm ready to help answer questions about the professional background using the provided context. How can I assist you?" }],
      },
      ...chatHistory,
    ],
    generationConfig: {
      temperature: 0.5,
      topP: 0.9,
      topK: 40,
      maxOutputTokens: 1024,
    },
  });

  const result = await chat.sendMessageStream(userMessage);

  for await (const chunk of result.stream) {
    const chunkText = chunk.text();
    if (chunkText) {
      yield chunkText;
    }
  }
}

// Job fit assessment with enhanced transferable skills analysis
export async function generateFitAssessment(
  jobDescription: string,
  relevantContext: string
): Promise<{
  overallFitScore: number;
  matchingSkills: string[];
  gaps: string[];
  transferableSkills: Array<{
    skill: string;
    relevance: string;
    confidence: number;
  }>;
  recommendations: string[];
  summary: string;
}> {
  const prompt = `Analyze the following job description against the candidate's experience and skills. Be thorough and honest in your assessment.

Job Description:
${jobDescription}

Candidate's Relevant Experience and Skills:
${relevantContext}

Provide a JSON response with the following structure:
{
  "overallFitScore": <number 0-100, be realistic>,
  "matchingSkills": [<list of skills that directly match job requirements - only include verified matches>],
  "gaps": [<list of required skills/experience that the candidate does not have - be honest about gaps>],
  "transferableSkills": [
    {
      "skill": "<a skill the candidate has that could bridge a gap>",
      "relevance": "<brief explanation of how this skill relates to the requirement>",
      "confidence": <0.0-1.0 confidence that this skill transfers>
    }
  ],
  "recommendations": [
    "<specific talking points for interviews>",
    "<ways to demonstrate transferable skills>",
    "<suggestions for addressing gaps>"
  ],
  "summary": "<honest 2-3 sentence summary of overall fit>"
}

Guidelines:
- Be objective and specific - don't inflate the match
- Only list skills as "matching" if there's clear evidence in the context
- For gaps, identify skills mentioned in the job description but not found in the candidate's background
- For transferable skills, identify related experience that could apply (e.g., "AWS experience" could transfer to "GCP" roles)
- Recommendations should be actionable and specific

Only include the JSON in your response.`;

  const result = await chatModel.generateContent(prompt);
  const response = result.response.text();

  // Extract JSON from response
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Failed to parse fit assessment response");
  }

  const parsed = JSON.parse(jsonMatch[0]);

  // Ensure transferableSkills exists
  if (!parsed.transferableSkills) {
    parsed.transferableSkills = [];
  }

  return parsed;
}

// AI-assisted content generation for admin
export async function generateSTARContent(
  rawNotes: string,
  targetField: "situation" | "task" | "action" | "result" | "lessonsLearned"
): Promise<string> {
  const fieldPrompts: Record<string, string> = {
    situation: "the business context and challenges that existed before the project",
    task: "the specific objectives and goals assigned to the professional",
    action: "the concrete steps and actions taken to address the situation",
    result: "the measurable outcomes and impact achieved",
    lessonsLearned: "key insights and takeaways from the project",
  };

  const prompt = `Transform the following rough notes into a professional STAR format ${targetField} section for a portfolio project.

Raw Notes:
${rawNotes}

Requirements for the ${targetField} section:
- Focus on: ${fieldPrompts[targetField]}
- Use professional, concise language
- Include specific details and metrics where mentioned
- Write in first person where appropriate
- Keep it to 2-4 sentences

Generate only the ${targetField} content, nothing else:`;

  const result = await chatModel.generateContent(prompt);
  return result.response.text().trim();
}

// Technology detection from project description
export async function detectTechnologies(description: string): Promise<Array<{
  name: string;
  confidence: number;
  category: string;
}>> {
  const prompt = `Analyze the following project description and extract all technologies, tools, frameworks, and platforms mentioned or implied.

Description:
${description}

Return a JSON array of detected technologies:
[
  {
    "name": "<technology name>",
    "confidence": <0.0-1.0 confidence score>,
    "category": "<one of: Cloud, DevOps, Programming Language, Framework, Database, Tool, Platform>"
  }
]

Only include technologies that are clearly mentioned or strongly implied. Return only the JSON array.`;

  const result = await chatModel.generateContent(prompt);
  const response = result.response.text();

  const jsonMatch = response.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    return [];
  }

  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return [];
  }
}

// Achievement suggestions for experience entries
export async function suggestAchievements(
  role: string,
  company: string,
  description: string
): Promise<string[]> {
  const prompt = `Generate 5-7 professional achievement bullet points for the following work experience. These should be specific and use action verbs.

Role: ${role}
Company: ${company}
Description: ${description || "Not provided"}

Format each achievement as a bullet point starting with an action verb. Include placeholders like [X%] or [Y months] where specific metrics would go.

Examples of good achievements:
- Reduced deployment time by [X%] through implementation of CI/CD pipelines
- Led team of [N] engineers to deliver [project] on time and under budget
- Architected scalable solution handling [X] requests per second

Generate achievements:`;

  const result = await chatModel.generateContent(prompt);
  const response = result.response.text();

  // Parse bullet points
  const achievements = response
    .split("\n")
    .filter((line) => line.trim().startsWith("-") || line.trim().startsWith("•"))
    .map((line) => line.replace(/^[-•]\s*/, "").trim())
    .filter((line) => line.length > 0);

  return achievements.slice(0, 7);
}
