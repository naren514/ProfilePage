type ChatHistoryEntry = { role: "user" | "model"; parts: Array<{ text: string }> };

function getOpenAIKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not configured");
  return key;
}

function getChatModel(): string {
  return process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";
}

function getEmbeddingModel(): string {
  return process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-large"; // 3072 dims
}

async function openAIChat(prompt: string, temperature = 0.3): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getOpenAIKey()}`,
    },
    body: JSON.stringify({
      model: getChatModel(),
      temperature,
      messages: [
        { role: "system", content: "You are a precise professional assistant. Follow the prompt exactly." },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!res.ok) throw new Error(`OpenAI chat failed: ${await res.text()}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() || "";
}

// Compatibility wrapper to avoid touching all callers.
export const chatModel = {
  async generateContent(prompt: string) {
    const textOut = await openAIChat(prompt, 0.3);
    return {
      response: {
        text() {
          return textOut;
        },
      },
    };
  },
};

export const embeddingModel = {
  async embedContent(text: string) {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getOpenAIKey()}`,
      },
      body: JSON.stringify({
        model: getEmbeddingModel(),
        input: text,
      }),
    });

    if (!res.ok) throw new Error(`OpenAI embeddings failed: ${await res.text()}`);
    const data = await res.json();
    return { embedding: { values: data?.data?.[0]?.embedding || [] } };
  },
};

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

Context from the portfolio is provided below.`;

export async function generateEmbedding(text: string): Promise<number[]> {
  const result = await embeddingModel.embedContent(text);
  return result.embedding.values;
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const embeddings: number[][] = [];
  const batchSize = 5;
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map((text) => generateEmbedding(text)));
    embeddings.push(...batchResults);
  }
  return embeddings;
}

export async function generateChatResponse(
  userMessage: string,
  context: string,
  chatHistory: ChatHistoryEntry[]
): Promise<string> {
  const historyText = chatHistory
    .map((h) => `${h.role}: ${h.parts.map((p) => p.text).join("\n")}`)
    .join("\n\n");

  const prompt = `System: ${SYSTEM_PROMPT}\n\nRelevant context:\n${context}\n\nConversation so far:\n${historyText}\n\nUser message:\n${userMessage}`;

  return openAIChat(prompt, 0.5);
}

export async function* streamChatResponse(
  userMessage: string,
  context: string,
  chatHistory: ChatHistoryEntry[]
): AsyncGenerator<string, void, unknown> {
  const text = await generateChatResponse(userMessage, context, chatHistory);
  yield text;
}

export async function generateFitAssessment(jobDescription: string, relevantContext: string): Promise<{
  overallFitScore: number;
  matchingSkills: string[];
  gaps: string[];
  transferableSkills: Array<{ skill: string; relevance: string; confidence: number }>;
  recommendations: string[];
  summary: string;
}> {
  const prompt = `Analyze this job description against candidate context and return strict JSON only.\n\nJob:\n${jobDescription}\n\nContext:\n${relevantContext}\n\nJSON schema:\n{\n  "overallFitScore": 0,\n  "matchingSkills": [],\n  "gaps": [],\n  "transferableSkills": [{"skill":"","relevance":"","confidence":0.0}],\n  "recommendations": [],\n  "summary": ""\n}`;

  const response = await openAIChat(prompt, 0.2);
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Failed to parse fit assessment response");
  const parsed = JSON.parse(jsonMatch[0]);
  parsed.transferableSkills = parsed.transferableSkills || [];
  return parsed;
}

export async function generateSTARContent(
  rawNotes: string,
  targetField: "situation" | "task" | "action" | "result" | "lessonsLearned"
): Promise<string> {
  const prompt = `Rewrite these notes into a professional STAR ${targetField} section (2-4 sentences):\n\n${rawNotes}`;
  return (await openAIChat(prompt, 0.4)).trim();
}

export async function detectTechnologies(description: string): Promise<Array<{ name: string; confidence: number; category: string }>> {
  const prompt = `Extract technologies from this description and return JSON array only:\n${description}\n\nFormat: [{"name":"","confidence":0.0,"category":"Cloud|DevOps|Programming Language|Framework|Database|Tool|Platform"}]`;
  const response = await openAIChat(prompt, 0.2);
  const jsonMatch = response.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];
  try { return JSON.parse(jsonMatch[0]); } catch { return []; }
}

export async function generateFromPrompt(prompt: string, context?: string): Promise<string> {
  return (await openAIChat(context ? `${prompt}\n\nContext:\n${context}` : prompt, 0.4)).trim();
}

export async function generateSummaryFromSTAR(starFields: {
  situation?: string;
  task?: string;
  action?: string;
  result?: string;
}): Promise<string> {
  const content = [
    starFields.situation && `Situation: ${starFields.situation}`,
    starFields.task && `Task: ${starFields.task}`,
    starFields.action && `Action: ${starFields.action}`,
    starFields.result && `Result: ${starFields.result}`,
  ].filter(Boolean).join("\n\n");

  if (!content.trim()) throw new Error("At least one STAR field is required");
  return (await openAIChat(`Generate a concise professional 2-3 sentence summary from:\n\n${content}`, 0.3)).trim();
}

export async function suggestAchievements(role: string, company: string, description: string): Promise<string[]> {
  const response = await openAIChat(
    `Generate 5-7 resume-style achievement bullets for role=${role}, company=${company}. Description: ${description || "N/A"}`,
    0.5
  );

  return response
    .split("\n")
    .filter((line) => line.trim().startsWith("-") || line.trim().startsWith("•"))
    .map((line) => line.replace(/^[-•]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 7);
}
