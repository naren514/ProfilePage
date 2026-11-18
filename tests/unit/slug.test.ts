import { describe, expect, it } from "vitest";
import { generateSlug, isValidSlug } from "@/lib/content/slug";
import { thoughtSchema } from "@/lib/validations/api-schemas";

describe("generateSlug", () => {
  it.each([
    ["Hello World", "hello-world"],
    ["  Leading & trailing!  ", "leading-trailing"],
    ["Café déjà vu", "cafe-deja-vu"],
    ["Multiple   ---  separators", "multiple-separators"],
    ["!!!", ""],
  ])("%s → %s", (input, expected) => {
    expect(generateSlug(input)).toBe(expected);
  });

  it("produces slugs the API accepts", () => {
    for (const title of ["What I learned in 2026", "AI: friend or foe?", "Notes — part 2"]) {
      const slug = generateSlug(title);
      expect(isValidSlug(slug)).toBe(true);
      expect(thoughtSchema.shape.slug.safeParse(slug).success).toBe(true);
    }
  });

  it("caps length without a trailing hyphen", () => {
    const slug = generateSlug("word ".repeat(100));
    expect(slug.length).toBeLessThanOrEqual(255);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("isValidSlug", () => {
  it.each(["", "Upper", "double--hyphen", "-leading", "trailing-", "spa ce", "a/b"])("rejects %j", (slug) => {
    expect(isValidSlug(slug)).toBe(false);
  });
});
