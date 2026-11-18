import { and, desc, eq, ilike, isNull, ne, or, sql, type SQL } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { atomic, db } from "@/lib/db";
import {
  stories,
  writingDocuments,
  writingRevisions,
  type EditorJSON,
  type Story,
  type WritingDocument,
} from "@/lib/db/schema";
import { htmlToPlainText } from "@/lib/content/sanitize";
import { pgErrorInfo } from "@/lib/http/errors";
import { syncEntityToRAG } from "@/lib/rag/sync";
import { documentStats, documentToHtml, htmlToDocument } from "./content";
import { emptyDocument } from "./extensions";
import { liveChangedOutsideStudio, needsSlugConfirmation, publishProblems } from "./publish-rules";

/** At most one automatic snapshot per this interval of editing (manual saves always snapshot). */
export const SNAPSHOT_INTERVAL_MS = 5 * 60 * 1000;

export type Failure =
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "conflict"; currentRevision?: number }
  | { ok: false; reason: "invalid"; problems: string[] }
  | { ok: false; reason: "slug_locked" }
  | { ok: false; reason: "slug_taken" }
  | { ok: false; reason: "published" };

type Result<T> = ({ ok: true } & T) | Failure;

// Guard for atomic batches: evaluates to NULL when the document isn't at the
// expected revision, so inserting it into a NOT NULL column aborts the batch.
function revisionGuard(documentId: string, baseRevision: number, offset = 0): SQL<number> {
  return sql<number>`(select current_revision + ${offset} from writing_documents where id = ${documentId} and current_revision = ${baseRevision})`;
}

function isGuardFailure(error: unknown): boolean {
  return pgErrorInfo(error).code === "23502";
}

function snapshotValues(doc: WritingDocument) {
  return {
    documentId: doc.id,
    revisionNumber: doc.currentRevision,
    title: doc.title,
    excerpt: doc.excerpt,
    bodyJson: doc.bodyJson,
    wordCount: doc.wordCount,
  };
}

function syncStoryInBackground(storyId: string) {
  db.select()
    .from(stories)
    .where(eq(stories.id, storyId))
    .limit(1)
    .then(([story]) => (story ? syncEntityToRAG("story", story) : undefined))
    .catch((err) => console.error("RAG sync failed for story:", err));
}

// ---------------------------------------------------------------------------
// Legacy import
// ---------------------------------------------------------------------------

/**
 * Give every story without a writing document one, converted from its HTML.
 * Idempotent: the unique story_id makes concurrent runs harmless.
 */
export async function importLegacyStories(ownerEmail: string): Promise<number> {
  const orphans = await db
    .select({ story: stories })
    .from(stories)
    .leftJoin(writingDocuments, eq(writingDocuments.storyId, stories.id))
    .where(isNull(writingDocuments.id));

  let imported = 0;
  for (const { story } of orphans) {
    let bodyJson: EditorJSON;
    try {
      bodyJson = htmlToDocument(story.action);
    } catch {
      const text = htmlToPlainText(story.action);
      bodyJson = { type: "doc", content: [{ type: "paragraph", ...(text ? { content: [{ type: "text", text }] } : {}) }] };
    }
    const { text, wordCount } = documentStats(bodyJson);
    const id = uuidv4();
    const inserted = await db
      .insert(writingDocuments)
      .values({
        id,
        ownerEmail,
        title: story.title,
        slug: story.slug,
        excerpt: story.summary,
        status: story.isPublished ? "PUBLISHED" : "DRAFT",
        bodyJson,
        bodyText: text,
        wordCount,
        tags: story.tags ?? [],
        postDate: story.date,
        currentRevision: 1,
        publishedRevision: story.isPublished ? 1 : null,
        storyId: story.id,
        source: "legacy_import",
        publishedAt: story.isPublished ? story.updatedAt : null,
        storySyncedAt: story.updatedAt,
        lastSnapshotAt: new Date(),
        createdAt: story.createdAt,
        updatedAt: story.updatedAt,
      })
      .onConflictDoNothing({ target: writingDocuments.storyId })
      .returning({ id: writingDocuments.id });

    if (inserted.length === 0) continue;
    await db.insert(writingRevisions).values({
      documentId: id,
      revisionNumber: 1,
      title: story.title,
      excerpt: story.summary,
      bodyJson,
      wordCount,
      changeOrigin: "import",
      legacyHtml: story.action,
      publishedSlug: story.isPublished ? story.slug : null,
      createdBy: ownerEmail,
    });
    imported++;
  }
  return imported;
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

export type DocumentFilter = "all" | "drafts" | "published";

export async function listDocuments(filter: DocumentFilter, query?: string) {
  const conditions: SQL[] = [ne(writingDocuments.status, "ARCHIVED")];
  if (filter === "drafts") conditions.push(ne(writingDocuments.status, "PUBLISHED"));
  if (filter === "published") conditions.push(eq(writingDocuments.status, "PUBLISHED"));
  const q = query?.trim();
  if (q) {
    const pattern = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    conditions.push(or(ilike(writingDocuments.title, pattern), ilike(writingDocuments.bodyText, pattern))!);
  }

  const rows = await db
    .select({
      id: writingDocuments.id,
      title: writingDocuments.title,
      slug: writingDocuments.slug,
      excerpt: writingDocuments.excerpt,
      status: writingDocuments.status,
      wordCount: writingDocuments.wordCount,
      tags: writingDocuments.tags,
      currentRevision: writingDocuments.currentRevision,
      publishedRevision: writingDocuments.publishedRevision,
      storySyncedAt: writingDocuments.storySyncedAt,
      createdAt: writingDocuments.createdAt,
      updatedAt: writingDocuments.updatedAt,
      liveSlug: stories.slug,
      liveIsPublished: stories.isPublished,
      liveUpdatedAt: stories.updatedAt,
    })
    .from(writingDocuments)
    .leftJoin(stories, eq(stories.id, writingDocuments.storyId))
    .where(and(...conditions))
    .orderBy(desc(writingDocuments.updatedAt));

  return rows.map(({ storySyncedAt, liveUpdatedAt, ...row }) => ({
    ...row,
    hasUnpublishedChanges: row.publishedRevision !== null && row.currentRevision > row.publishedRevision,
    liveChangedOutside: liveChangedOutsideStudio(liveUpdatedAt, storySyncedAt),
  }));
}

export async function getDocument(id: string) {
  const [row] = await db
    .select({ doc: writingDocuments, story: stories })
    .from(writingDocuments)
    .leftJoin(stories, eq(stories.id, writingDocuments.storyId))
    .where(eq(writingDocuments.id, id))
    .limit(1);
  if (!row) return null;
  return { doc: row.doc, story: row.story as Story | null };
}

/** The document plus live-post facts the editor needs. */
export function presentDocument(doc: WritingDocument, story: Story | null) {
  return {
    ...doc,
    live: story
      ? { slug: story.slug, isPublished: story.isPublished, updatedAt: story.updatedAt }
      : null,
    hasUnpublishedChanges: doc.publishedRevision !== null && doc.currentRevision > doc.publishedRevision,
    liveChangedOutside: liveChangedOutsideStudio(story?.updatedAt ?? null, doc.storySyncedAt),
  };
}

export async function listRevisions(documentId: string) {
  return db
    .select({
      id: writingRevisions.id,
      revisionNumber: writingRevisions.revisionNumber,
      changeOrigin: writingRevisions.changeOrigin,
      title: writingRevisions.title,
      wordCount: writingRevisions.wordCount,
      publishedSlug: writingRevisions.publishedSlug,
      createdBy: writingRevisions.createdBy,
      createdAt: writingRevisions.createdAt,
    })
    .from(writingRevisions)
    .where(eq(writingRevisions.documentId, documentId))
    .orderBy(desc(writingRevisions.createdAt))
    .limit(200);
}

export async function getRevision(documentId: string, revisionId: string) {
  const [revision] = await db
    .select()
    .from(writingRevisions)
    .where(and(eq(writingRevisions.id, revisionId), eq(writingRevisions.documentId, documentId)))
    .limit(1);
  return revision ?? null;
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

export async function createDocument(ownerEmail: string) {
  const [doc] = await db
    .insert(writingDocuments)
    .values({ ownerEmail, bodyJson: emptyDocument() })
    .returning();
  return doc;
}

export interface SaveInput {
  baseRevision: number;
  title?: string;
  excerpt?: string;
  slug?: string | null;
  tags?: string[];
  postDate?: string | null;
  bodyJson?: EditorJSON;
  /** "manual" always records a version; autosaves record one every few minutes. */
  snapshot?: "manual";
}

/** Save a change, only if nobody else saved since baseRevision (compare-and-swap). */
export async function saveDocument(id: string, input: SaveInput, userEmail: string): Promise<Result<{ doc: WritingDocument }>> {
  const now = new Date();
  const set: Partial<typeof writingDocuments.$inferInsert> = { updatedAt: now };
  if (input.title !== undefined) set.title = input.title;
  if (input.excerpt !== undefined) set.excerpt = input.excerpt;
  if (input.slug !== undefined) set.slug = input.slug || null;
  if (input.tags !== undefined) set.tags = input.tags;
  if (input.postDate !== undefined) set.postDate = input.postDate || null;
  if (input.bodyJson !== undefined) {
    const { text, wordCount } = documentStats(input.bodyJson);
    set.bodyJson = input.bodyJson;
    set.bodyText = text;
    set.wordCount = wordCount;
  }

  const [doc] = await db
    .update(writingDocuments)
    .set({ ...set, currentRevision: sql`${writingDocuments.currentRevision} + 1` })
    .where(and(eq(writingDocuments.id, id), eq(writingDocuments.currentRevision, input.baseRevision)))
    .returning();

  if (!doc) return conflictOrMissing(id);

  const due =
    input.snapshot === "manual" ||
    !doc.lastSnapshotAt ||
    now.getTime() - doc.lastSnapshotAt.getTime() >= SNAPSHOT_INTERVAL_MS;
  if (due) {
    await atomic([
      db.insert(writingRevisions).values({
        ...snapshotValues(doc),
        changeOrigin: input.snapshot === "manual" ? "manual" : "autosave",
        createdBy: userEmail,
      }),
      db.update(writingDocuments).set({ lastSnapshotAt: now }).where(eq(writingDocuments.id, id)),
    ]);
    doc.lastSnapshotAt = now;
  }
  return { ok: true, doc };
}

async function conflictOrMissing(id: string): Promise<Failure> {
  const [current] = await db
    .select({ currentRevision: writingDocuments.currentRevision })
    .from(writingDocuments)
    .where(eq(writingDocuments.id, id))
    .limit(1);
  return current ? { ok: false, reason: "conflict", currentRevision: current.currentRevision } : { ok: false, reason: "not_found" };
}

/** Replace title, excerpt and body with an older version. Creates a new revision; history is kept. */
export async function restoreRevision(
  id: string,
  revisionId: string,
  baseRevision: number,
  userEmail: string
): Promise<Result<{ doc: WritingDocument }>> {
  const revision = await getRevision(id, revisionId);
  if (!revision) return { ok: false, reason: "not_found" };
  return replaceContent(id, baseRevision, userEmail, "restore", {
    title: revision.title,
    excerpt: revision.excerpt,
    bodyJson: revision.bodyJson,
  });
}

/** Bring a post edited outside the Studio (classic editor) back into the draft. */
export async function pullLiveVersion(id: string, baseRevision: number, userEmail: string): Promise<Result<{ doc: WritingDocument }>> {
  const found = await getDocument(id);
  if (!found) return { ok: false, reason: "not_found" };
  const { story } = found;
  if (!story) return { ok: false, reason: "not_found" };
  return replaceContent(
    id,
    baseRevision,
    userEmail,
    "pull_live",
    {
      title: story.title,
      excerpt: story.summary,
      bodyJson: htmlToDocument(story.action),
      slug: story.slug,
      tags: story.tags ?? [],
      postDate: story.date,
    },
    { storySyncedAt: story.updatedAt, legacyHtml: story.action, livePublished: story.isPublished }
  );
}

async function replaceContent(
  id: string,
  baseRevision: number,
  userEmail: string,
  origin: "restore" | "pull_live",
  content: { title: string; excerpt: string; bodyJson: EditorJSON; slug?: string; tags?: string[]; postDate?: string | null },
  extra: { storySyncedAt?: Date; legacyHtml?: string | null; livePublished?: boolean } = {}
): Promise<Result<{ doc: WritingDocument }>> {
  const now = new Date();
  const { text, wordCount } = documentStats(content.bodyJson);
  try {
    await atomic([
      db.insert(writingRevisions).values({
        documentId: id,
        revisionNumber: revisionGuard(id, baseRevision, 1),
        title: content.title,
        excerpt: content.excerpt,
        bodyJson: content.bodyJson,
        wordCount,
        changeOrigin: origin,
        legacyHtml: extra.legacyHtml ?? null,
        createdBy: userEmail,
      }),
      db
        .update(writingDocuments)
        .set({
          ...content,
          bodyText: text,
          wordCount,
          currentRevision: baseRevision + 1,
          lastSnapshotAt: now,
          updatedAt: now,
          ...(extra.storySyncedAt ? { storySyncedAt: extra.storySyncedAt } : {}),
          // After pulling a live post in, the draft matches what's published
          ...(extra.livePublished ? { publishedRevision: baseRevision + 1 } : {}),
        })
        .where(and(eq(writingDocuments.id, id), eq(writingDocuments.currentRevision, baseRevision))),
    ]);
  } catch (error) {
    if (isGuardFailure(error)) return conflictOrMissing(id);
    throw error;
  }
  const found = await getDocument(id);
  return found ? { ok: true, doc: found.doc } : { ok: false, reason: "not_found" };
}

// ---------------------------------------------------------------------------
// Publishing
// ---------------------------------------------------------------------------

export interface PublishInput {
  baseRevision: number;
  idempotencyKey: string;
  confirmSlugChange?: boolean;
}

/**
 * Copy the draft at baseRevision into its public story row, atomically.
 * Legacy STAR fields on the story are left untouched.
 */
export async function publishDocument(
  id: string,
  input: PublishInput,
  userEmail: string
): Promise<Result<{ storyId: string; slug: string; alreadyPublished?: boolean }>> {
  const [previous] = await db
    .select({ documentId: writingRevisions.documentId, publishedSlug: writingRevisions.publishedSlug })
    .from(writingRevisions)
    .where(eq(writingRevisions.idempotencyKey, input.idempotencyKey))
    .limit(1);
  if (previous) {
    if (previous.documentId !== id) return { ok: false, reason: "conflict" };
    const found = await getDocument(id);
    return { ok: true, storyId: found?.doc.storyId ?? "", slug: previous.publishedSlug ?? "", alreadyPublished: true };
  }

  const found = await getDocument(id);
  if (!found) return { ok: false, reason: "not_found" };
  const { doc, story } = found;
  if (doc.currentRevision !== input.baseRevision) {
    return { ok: false, reason: "conflict", currentRevision: doc.currentRevision };
  }

  const problems = publishProblems(doc);
  if (problems.length > 0) return { ok: false, reason: "invalid", problems };
  if (needsSlugConfirmation(story, doc.slug, input.confirmSlugChange === true)) {
    return { ok: false, reason: "slug_locked" };
  }

  const slug = doc.slug!;
  const now = new Date();
  const storyId = story?.id ?? uuidv4();
  const liveFields = {
    title: doc.title.trim(),
    slug,
    summary: doc.excerpt.trim(),
    action: documentToHtml(doc.bodyJson),
    date: doc.postDate,
    tags: doc.tags,
    isPublished: true,
    updatedAt: now,
  };

  try {
    await atomic([
      db.insert(writingRevisions).values({
        ...snapshotValues(doc),
        revisionNumber: revisionGuard(id, input.baseRevision),
        changeOrigin: "publish",
        publishedSlug: slug,
        idempotencyKey: input.idempotencyKey,
        createdBy: userEmail,
      }),
      story
        ? db.update(stories).set(liveFields).where(eq(stories.id, story.id))
        : db.insert(stories).values({ id: storyId, ...liveFields, createdAt: now }),
      db
        .update(writingDocuments)
        .set({
          status: "PUBLISHED",
          publishedRevision: input.baseRevision,
          storyId,
          publishedAt: now,
          storySyncedAt: now,
        })
        .where(eq(writingDocuments.id, id)),
    ]);
  } catch (error) {
    const { code, constraint } = pgErrorInfo(error);
    if (isGuardFailure(error)) return conflictOrMissing(id);
    if (code === "23505" && constraint?.includes("idempotency")) {
      return { ok: true, storyId, slug, alreadyPublished: true };
    }
    if (code === "23505") return { ok: false, reason: "slug_taken" };
    throw error;
  }

  syncStoryInBackground(storyId);
  return { ok: true, storyId, slug };
}

/** Take the live post down. The draft and its history stay. */
export async function unpublishDocument(id: string): Promise<Result<object>> {
  const found = await getDocument(id);
  if (!found) return { ok: false, reason: "not_found" };
  const { doc, story } = found;
  const now = new Date();
  await atomic([
    ...(story ? [db.update(stories).set({ isPublished: false, updatedAt: now }).where(eq(stories.id, story.id))] : []),
    db
      .update(writingDocuments)
      .set({ status: "DRAFT", publishedRevision: null, storySyncedAt: now })
      .where(eq(writingDocuments.id, doc.id)),
  ] as unknown as Parameters<typeof atomic>[0]);
  if (story) syncStoryInBackground(story.id);
  return { ok: true };
}

/** Delete a draft and its history. Published posts must be unpublished first. */
export async function deleteDocument(id: string): Promise<Result<object>> {
  const found = await getDocument(id);
  if (!found) return { ok: false, reason: "not_found" };
  const { doc, story } = found;
  if (doc.status === "PUBLISHED" || story?.isPublished) return { ok: false, reason: "published" };
  await atomic([
    db.delete(writingDocuments).where(eq(writingDocuments.id, doc.id)),
    ...(story ? [db.delete(stories).where(eq(stories.id, story.id))] : []),
  ] as unknown as Parameters<typeof atomic>[0]);
  return { ok: true };
}
