import { and, desc, eq, ilike, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { writingDocuments, writingIdeas, writingSources, type WritingIdea } from "@/lib/db/schema";
import { createHash } from "crypto";
import { documentStats, htmlToDocument } from "./content";
import { escapeHtml } from "@/lib/agent/workflows/shared";

export const ideaInputSchema = z.object({
  content: z.string().trim().min(1, "Write something first").max(8000),
  tags: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
});

export const ideaUpdateSchema = z.object({
  status: z.enum(["new", "archived"]).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
});

export type IdeaFilter = "inbox" | "converted" | "archived";

export async function listIdeas(filter: IdeaFilter, query?: string): Promise<WritingIdea[]> {
  const status = filter === "inbox" ? "new" : filter;
  const conditions = [eq(writingIdeas.status, status)];
  if (query?.trim()) conditions.push(ilike(writingIdeas.content, `%${query.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`));
  return db.select().from(writingIdeas).where(and(...conditions)).orderBy(desc(writingIdeas.createdAt)).limit(200);
}

export async function createIdea(input: z.infer<typeof ideaInputSchema>): Promise<WritingIdea> {
  const [idea] = await db.insert(writingIdeas).values({ content: input.content, tags: input.tags }).returning();
  return idea;
}

export async function getIdea(id: string): Promise<WritingIdea | null> {
  const [idea] = await db.select().from(writingIdeas).where(eq(writingIdeas.id, id)).limit(1);
  return idea ?? null;
}

export async function updateIdea(id: string, input: z.infer<typeof ideaUpdateSchema>): Promise<WritingIdea | null> {
  const [idea] = await db
    .update(writingIdeas)
    .set({ ...input, updatedAt: new Date() })
    // A converted idea stays converted
    .where(and(eq(writingIdeas.id, id), ne(writingIdeas.status, "converted")))
    .returning();
  return idea ?? null;
}

export async function deleteIdea(id: string): Promise<boolean> {
  const rows = await db.delete(writingIdeas).where(eq(writingIdeas.id, id)).returning({ id: writingIdeas.id });
  return rows.length > 0;
}

/** Start a draft from an idea. The idea's text is kept unchanged; repeating returns the same draft. */
export async function convertIdea(id: string, user: string): Promise<{ documentId: string } | null> {
  const idea = await getIdea(id);
  if (!idea) return null;
  if (idea.linkedDocumentId) return { documentId: idea.linkedDocumentId };

  const paragraphs = idea.content
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const bodyJson = htmlToDocument(paragraphs);
  const { text, wordCount } = documentStats(bodyJson);
  const firstLine = idea.content.split("\n")[0].trim();
  const [doc] = await db
    .insert(writingDocuments)
    .values({
      ownerEmail: user,
      title: firstLine.length <= 90 ? firstLine : "",
      bodyJson,
      bodyText: text,
      wordCount,
      tags: idea.tags,
    })
    .returning({ id: writingDocuments.id });
  const [linked] = await db
    .update(writingIdeas)
    .set({ status: "converted", linkedDocumentId: doc.id, updatedAt: new Date() })
    .where(and(eq(writingIdeas.id, id), eq(writingIdeas.status, idea.status)))
    .returning({ linked: writingIdeas.linkedDocumentId });
  if (!linked) {
    // Converted concurrently: keep the other draft, discard this one
    await db.delete(writingDocuments).where(eq(writingDocuments.id, doc.id));
    const again = await getIdea(id);
    return again?.linkedDocumentId ? { documentId: again.linkedDocumentId } : null;
  }
  // The articles the idea came from start the post's source library
  if (idea.sources?.length) {
    await db.insert(writingSources).values(
      idea.sources.map((s) => ({
        documentId: doc.id,
        url: s.url,
        title: s.title,
        publisher: s.publisher,
        excerpt: "",
        contentHash: createHash("sha256").update(s.url).digest("hex"),
        query: "From your reading",
        provider: "reading",
      }))
    );
  }
  return { documentId: doc.id };
}
