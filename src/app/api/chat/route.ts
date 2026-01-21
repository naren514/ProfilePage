import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chatSessions, chatMessages, tokenUsage } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { generateChatResponse } from "@/lib/ai/gemini";
import { multiQueryRetrieve, formatContextFromChunks } from "@/lib/rag/retriever";
import { chatMessageSchema, validateInput } from "@/lib/validations/api-schemas";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input with Zod
    const validation = validateInput(chatMessageSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const { message, sessionId: existingSessionId } = validation.data;

    // Get or create session
    let sessionId = existingSessionId;
    let session;

    if (sessionId) {
      const sessions = await db
        .select()
        .from(chatSessions)
        .where(eq(chatSessions.id, sessionId))
        .limit(1);

      if (sessions.length > 0) {
        session = sessions[0];
      }
    }

    if (!session) {
      // Create new session
      const newSessions = await db
        .insert(chatSessions)
        .values({
          visitorId: crypto.randomUUID(),
          metadata: {
            userAgent: request.headers.get("user-agent") || undefined,
          },
        })
        .returning();

      session = newSessions[0];
      sessionId = session.id;
    }

    // Save user message
    await db.insert(chatMessages).values({
      sessionId,
      role: "user",
      content: message,
    });

    // Get chat history for context
    const history = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId))
      .orderBy(chatMessages.createdAt)
      .limit(10);

    // Retrieve relevant context using RAG with multi-query for better coverage
    const retrievedChunks = await multiQueryRetrieve(message, {
      topK: 8,
      threshold: 0.35,
    });

    const context = formatContextFromChunks(retrievedChunks);

    // Format chat history for Gemini
    const chatHistory = history.slice(0, -1).map((msg) => ({
      role: msg.role === "user" ? "user" as const : "model" as const,
      parts: [{ text: msg.content }],
    }));

    // Generate response
    const response = await generateChatResponse(message, context, chatHistory);

    // Save assistant response
    await db.insert(chatMessages).values({
      sessionId,
      role: "assistant",
      content: response,
      retrievedChunks: retrievedChunks.map((chunk) => ({
        chunkId: chunk.id,
        similarity: chunk.similarity,
        content: chunk.content.substring(0, 200),
      })),
    });

    // Update session stats
    await db
      .update(chatSessions)
      .set({
        totalMessages: sql`${chatSessions.totalMessages} + 2`,
        updatedAt: new Date(),
      })
      .where(eq(chatSessions.id, sessionId));

    // Track token usage (rough estimate)
    const today = new Date().toISOString().split("T")[0];
    const promptTokens = Math.ceil((message.length + context.length) / 4);
    const completionTokens = Math.ceil(response.length / 4);

    await db
      .insert(tokenUsage)
      .values({
        date: today,
        model: "gemini-2.0-flash-exp",
        operation: "chat",
        promptTokens,
        completionTokens,
        requestCount: 1,
      })
      .onConflictDoUpdate({
        target: [tokenUsage.date, tokenUsage.model, tokenUsage.operation],
        set: {
          promptTokens: sql`${tokenUsage.promptTokens} + ${promptTokens}`,
          completionTokens: sql`${tokenUsage.completionTokens} + ${completionTokens}`,
          requestCount: sql`${tokenUsage.requestCount} + 1`,
        },
      });

    return NextResponse.json({
      response,
      sessionId,
      retrievedChunks: retrievedChunks.length,
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Failed to process chat message" },
      { status: 500 }
    );
  }
}
