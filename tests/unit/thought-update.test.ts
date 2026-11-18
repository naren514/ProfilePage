import { describe, expect, it } from "vitest";
import { buildThoughtUpdate, isBlockedSlugChange } from "@/lib/content/thought-update";
import { thoughtSchema, thoughtUpdateSchema } from "@/lib/validations/api-schemas";
import { filterPublishedStories, isEligibleForPublicRAG } from "@/lib/rag/eligibility";

describe("isBlockedSlugChange", () => {
  const published = { slug: "my-post", isPublished: true };
  const draft = { slug: "my-post", isPublished: false };

  it("blocks changing a published post's slug without confirmation", () => {
    expect(isBlockedSlugChange(published, { slug: "new-slug" })).toBe(true);
  });
  it("allows it with confirmation", () => {
    expect(isBlockedSlugChange(published, { slug: "new-slug", confirmSlugChange: true })).toBe(false);
  });
  it("allows drafts to change freely", () => {
    expect(isBlockedSlugChange(draft, { slug: "new-slug" })).toBe(false);
  });
  it("ignores an unchanged or missing slug", () => {
    expect(isBlockedSlugChange(published, { slug: "my-post" })).toBe(false);
    expect(isBlockedSlugChange(published, { title: "New title" })).toBe(false);
  });
});

describe("buildThoughtUpdate", () => {
  it("only writes fields the request contains, so legacy STAR content survives", () => {
    const update = buildThoughtUpdate(thoughtUpdateSchema.parse({ title: "T", action: "<p>Body</p>" }));
    expect(update).toEqual({ title: "T", action: "<p>Body</p>" });
    expect("situation" in update).toBe(false);
    expect("result" in update).toBe(false);
  });

  it("never fills in defaults, so a partial save can't unpublish a post", () => {
    const update = buildThoughtUpdate(thoughtUpdateSchema.parse({ summary: "New excerpt" }));
    expect(update).toEqual({ summary: "New excerpt" });
  });

  it("sanitizes the body", () => {
    const update = buildThoughtUpdate({ action: '<p>ok</p><script>alert(1)</script>' });
    expect(update.action).toBe("<p>ok</p>");
  });
});

describe("thought schemas", () => {
  const valid = { title: "A post", slug: "a-post", summary: "Excerpt", action: "<p>x</p>" };

  it("accepts a typical editor payload with an empty date", () => {
    const parsed = thoughtSchema.parse({ ...valid, date: "", tags: ["ai"] });
    expect(parsed.date).toBeNull();
    expect(parsed.isPublished).toBe(false);
  });

  it("accepts long post bodies", () => {
    const body = "<p>" + "word ".repeat(20_000) + "</p>"; // ~20k words
    expect(thoughtSchema.safeParse({ ...valid, action: body }).success).toBe(true);
  });

  it("rejects bad slugs and missing titles", () => {
    expect(thoughtSchema.safeParse({ ...valid, slug: "Bad Slug" }).success).toBe(false);
    expect(thoughtSchema.safeParse({ ...valid, title: "  " }).success).toBe(false);
  });

  it("requires expectedUpdatedAt to be a timestamp", () => {
    expect(thoughtUpdateSchema.safeParse({ expectedUpdatedAt: "yesterday" }).success).toBe(false);
    expect(thoughtUpdateSchema.safeParse({ expectedUpdatedAt: "2026-11-18T10:00:00.123Z" }).success).toBe(true);
  });
});

describe("public chatbot eligibility", () => {
  it("only lets published posts through", () => {
    expect(isEligibleForPublicRAG("story", { isPublished: true })).toBe(true);
    expect(isEligibleForPublicRAG("story", { isPublished: false })).toBe(false);
    expect(isEligibleForPublicRAG("story", {})).toBe(false);
  });

  it("leaves other content types alone", () => {
    expect(isEligibleForPublicRAG("project", { isPublished: false })).toBe(true);
  });

  it("filters a mixed list", () => {
    const rows = [{ id: 1, isPublished: true }, { id: 2, isPublished: false }, { id: 3, isPublished: null }];
    expect(filterPublishedStories(rows).map((r) => r.id)).toEqual([1]);
  });
});
