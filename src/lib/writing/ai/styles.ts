import { and, asc, desc, eq, inArray, ne } from "drizzle-orm";
import { z } from "zod";
import { atomic, db } from "@/lib/db";
import {
  writingDocuments,
  writingStyles,
  writingStyleVersions,
  type StyleRules,
  type WritingStyle,
} from "@/lib/db/schema";

export const styleInputSchema = z.object({
  name: z.string().trim().min(1, "Give the style a name").max(80),
  description: z.string().trim().max(300).default(""),
  rules: z.object({
    voice: z.string().trim().max(1000).optional(),
    sentences: z.string().trim().max(1000).optional(),
    structure: z.string().trim().max(1000).optional(),
    avoid: z.array(z.string().trim().min(1).max(80)).max(40).optional(),
    other: z.string().trim().max(2000).optional(),
  }),
  exampleDocumentIds: z.array(z.string().uuid()).max(2).default([]),
});

export type StyleInput = z.infer<typeof styleInputSchema>;

export async function listStyles(): Promise<WritingStyle[]> {
  return db
    .select()
    .from(writingStyles)
    .where(eq(writingStyles.archived, false))
    .orderBy(desc(writingStyles.isDefault), asc(writingStyles.name));
}

export async function getStyle(id: string): Promise<WritingStyle | null> {
  const [style] = await db.select().from(writingStyles).where(eq(writingStyles.id, id)).limit(1);
  return style ?? null;
}

export async function getDefaultStyle(): Promise<WritingStyle | null> {
  const [style] = await db
    .select()
    .from(writingStyles)
    .where(and(eq(writingStyles.isDefault, true), eq(writingStyles.archived, false)))
    .limit(1);
  return style ?? null;
}

/** The style a document uses: its own choice, else the default. */
export async function resolveStyle(styleId: string | null | undefined): Promise<WritingStyle | null> {
  if (styleId) {
    const style = await getStyle(styleId);
    if (style && !style.archived) return style;
  }
  return getDefaultStyle();
}

/** Example passages for a style, from the documents the author picked. */
export async function styleExamples(style: WritingStyle): Promise<Array<{ title: string; text: string }>> {
  if (style.exampleDocumentIds.length === 0) return [];
  const rows = await db
    .select({ title: writingDocuments.title, text: writingDocuments.bodyText })
    .from(writingDocuments)
    .where(inArray(writingDocuments.id, style.exampleDocumentIds));
  return rows.map((r) => ({ title: r.title || "Untitled", text: r.text }));
}

function versionRow(style: Pick<WritingStyle, "id" | "version" | "name" | "description" | "rules" | "exampleDocumentIds">, by: string) {
  return {
    styleId: style.id,
    version: style.version,
    name: style.name,
    description: style.description,
    rules: style.rules,
    exampleDocumentIds: style.exampleDocumentIds,
    createdBy: by,
  };
}

function cleanRules(rules: StyleInput["rules"]): StyleRules {
  const out: StyleRules = {};
  if (rules.voice) out.voice = rules.voice;
  if (rules.sentences) out.sentences = rules.sentences;
  if (rules.structure) out.structure = rules.structure;
  if (rules.avoid?.length) out.avoid = Array.from(new Set(rules.avoid));
  if (rules.other) out.other = rules.other;
  return out;
}

export async function createStyle(input: StyleInput, by: string): Promise<WritingStyle> {
  const hasDefault = Boolean(await getDefaultStyle());
  const [style] = await db
    .insert(writingStyles)
    .values({
      name: input.name,
      description: input.description,
      rules: cleanRules(input.rules),
      exampleDocumentIds: input.exampleDocumentIds,
      isDefault: !hasDefault,
    })
    .returning();
  await db.insert(writingStyleVersions).values(versionRow(style, by));
  return style;
}

/** Every save is a new version; earlier versions stay restorable. */
export async function updateStyle(id: string, input: StyleInput, by: string): Promise<WritingStyle | null> {
  const current = await getStyle(id);
  if (!current) return null;
  // Starter styles have no history row yet: record their original text first
  const [existingHistory] = await db
    .select({ id: writingStyleVersions.id })
    .from(writingStyleVersions)
    .where(eq(writingStyleVersions.styleId, id))
    .limit(1);
  if (!existingHistory) await db.insert(writingStyleVersions).values(versionRow(current, "starter"));

  const next = {
    name: input.name,
    description: input.description,
    rules: cleanRules(input.rules),
    exampleDocumentIds: input.exampleDocumentIds,
    version: current.version + 1,
    updatedAt: new Date(),
  };
  const [, [updated]] = await atomic([
    db.insert(writingStyleVersions).values(versionRow({ ...current, ...next }, by)),
    db.update(writingStyles).set(next).where(eq(writingStyles.id, id)).returning(),
  ]);
  return (updated as WritingStyle) ?? null;
}

export async function setDefaultStyle(id: string): Promise<boolean> {
  const style = await getStyle(id);
  if (!style || style.archived) return false;
  await atomic([
    db.update(writingStyles).set({ isDefault: false }).where(ne(writingStyles.id, id)),
    db.update(writingStyles).set({ isDefault: true }).where(eq(writingStyles.id, id)),
  ]);
  return true;
}

export type ArchiveResult = "ok" | "not_found" | "is_default";

/** Hide a style. Posts using it fall back to the default style. */
export async function archiveStyle(id: string): Promise<ArchiveResult> {
  const style = await getStyle(id);
  if (!style) return "not_found";
  if (style.isDefault) return "is_default";
  await atomic([
    db.update(writingStyles).set({ archived: true, updatedAt: new Date() }).where(eq(writingStyles.id, id)),
    db.update(writingDocuments).set({ styleId: null }).where(eq(writingDocuments.styleId, id)),
  ]);
  return "ok";
}

export async function listStyleVersions(id: string) {
  return db
    .select()
    .from(writingStyleVersions)
    .where(eq(writingStyleVersions.styleId, id))
    .orderBy(desc(writingStyleVersions.version))
    .limit(100);
}

export async function restoreStyleVersion(id: string, versionId: string, by: string): Promise<WritingStyle | null> {
  const [version] = await db
    .select()
    .from(writingStyleVersions)
    .where(and(eq(writingStyleVersions.id, versionId), eq(writingStyleVersions.styleId, id)))
    .limit(1);
  if (!version) return null;
  return updateStyle(
    id,
    {
      name: version.name,
      description: version.description,
      rules: version.rules,
      exampleDocumentIds: version.exampleDocumentIds,
    },
    by
  );
}
