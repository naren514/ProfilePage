import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chatSessions, chatMessages } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");
    const format = searchParams.get("format") || "markdown";

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 }
      );
    }

    // Get session
    const session = await db
      .select()
      .from(chatSessions)
      .where(eq(chatSessions.id, sessionId))
      .limit(1);

    if (session.length === 0) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    // Get messages
    const messages = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId))
      .orderBy(asc(chatMessages.createdAt));

    if (format === "json") {
      return NextResponse.json({
        session: session[0],
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
          timestamp: m.createdAt,
        })),
      });
    }

    // Generate Markdown format
    const markdown = generateMarkdownExport(session[0], messages);

    return new NextResponse(markdown, {
      headers: {
        "Content-Type": "text/markdown",
        "Content-Disposition": `attachment; filename="chat-export-${sessionId.slice(0, 8)}.md"`,
      },
    });
  } catch (error) {
    console.error("Chat export error:", error);
    return NextResponse.json(
      { error: "Failed to export chat" },
      { status: 500 }
    );
  }
}

function generateMarkdownExport(
  session: typeof chatSessions.$inferSelect,
  messages: (typeof chatMessages.$inferSelect)[]
): string {
  const date = new Date(session.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  let markdown = `# Chat Session Export
**Date:** ${date}
**Messages:** ${messages.length}
**Total Tokens:** ${session.totalTokens || 0}

---

`;

  for (const message of messages) {
    const timestamp = new Date(message.createdAt).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const roleLabel = message.role === "user" ? "You" : "Portfolio AI";
    const roleEmoji = message.role === "user" ? "👤" : "🤖";

    markdown += `### ${roleEmoji} ${roleLabel} (${timestamp})

${message.content}

`;
  }

  markdown += `---
*Exported from Aham Portfolio*
`;

  return markdown;
}

// POST endpoint to export by visitor ID (for anonymous users)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { visitorId, format = "markdown" } = body;

    if (!visitorId) {
      return NextResponse.json(
        { error: "Visitor ID is required" },
        { status: 400 }
      );
    }

    // Get latest session for visitor
    const session = await db
      .select()
      .from(chatSessions)
      .where(eq(chatSessions.visitorId, visitorId))
      .orderBy(asc(chatSessions.createdAt))
      .limit(1);

    if (session.length === 0) {
      return NextResponse.json(
        { error: "No chat session found" },
        { status: 404 }
      );
    }

    // Get messages
    const messages = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, session[0].id))
      .orderBy(asc(chatMessages.createdAt));

    if (format === "json") {
      return NextResponse.json({
        session: session[0],
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
          timestamp: m.createdAt,
        })),
      });
    }

    // Generate Markdown format
    const markdown = generateMarkdownExport(session[0], messages);

    return NextResponse.json({ markdown });
  } catch (error) {
    console.error("Chat export error:", error);
    return NextResponse.json(
      { error: "Failed to export chat" },
      { status: 500 }
    );
  }
}
