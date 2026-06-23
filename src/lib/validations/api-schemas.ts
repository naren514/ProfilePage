import { z } from "zod";

// ============================================
// Common Schemas
// ============================================

export const uuidSchema = z.string().uuid();

export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)");

export const urlSchema = z.string().url().optional().nullable().or(z.literal(""));

// ============================================
// Chat Schemas
// ============================================

export const chatMessageSchema = z.object({
  message: z
    .string()
    .min(1, "Message is required")
    .max(10000, "Message too long"),
  sessionId: z.string().uuid().optional().nullable(),
});

export type ChatMessageInput = z.infer<typeof chatMessageSchema>;

// ============================================
// Experience Schemas
// ============================================

export const experienceSchema = z.object({
  company: z.string().min(1, "Company is required").max(200),
  title: z.string().min(1, "Title is required").max(200),
  location: z.string().max(200).optional().nullable(),
  employmentType: z.enum(["full-time", "part-time", "contract", "internship", "freelance"]).default("full-time"),
  startDate: dateSchema,
  endDate: dateSchema.optional().nullable(),
  isCurrent: z.boolean().default(false),
  description: z.string().max(5000).optional().nullable(),
  achievements: z.array(z.string().max(500)).max(20).default([]),
  technologies: z.array(z.string().max(100)).max(50).default([]),
});

export type ExperienceInput = z.infer<typeof experienceSchema>;

// ============================================
// Project Schemas
// ============================================

export const projectSchema = z.object({
  slug: z.string().min(1).max(255).regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  title: z.string().min(1, "Title is required").max(200),
  summary: z.string().min(1, "Summary is required").max(3000),
  thumbnailUrl: urlSchema,
  websiteUrl: urlSchema,
  situation: z.string().max(5000).optional().nullable(),
  task: z.string().max(5000).optional().nullable(),
  action: z.string().max(5000).optional().nullable(),
  result: z.string().max(5000).optional().nullable(),
  lessonsLearned: z.string().max(5000).optional().nullable(),
  technologies: z.array(z.string().max(100)).max(50).default([]),
  company: z.string().max(200).optional().nullable(),
  role: z.string().max(200).optional().nullable(),
  startDate: dateSchema.optional().nullable(),
  endDate: dateSchema.optional().nullable(),
  isFeatured: z.boolean().default(false),
  isPublished: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(1000).default(0),
});

export type ProjectInput = z.infer<typeof projectSchema>;

// ============================================
// Certification Schemas
// ============================================

export const certificationSchema = z.object({
  articleTitle: z.string().min(1, "Title is required").max(200),
  source: z.string().min(1, "Source is required").max(200),
  excerpt: z.string().max(5000).optional().nullable(),
  articleUrl: urlSchema,
  publishedDate: dateSchema,
  followUpDate: dateSchema.optional().nullable(),
  coverImageUrl: urlSchema,
  isPublished: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(1000).default(0),
});

export type CertificationInput = z.infer<typeof certificationSchema>;

// ============================================
// Skill Schemas
// ============================================

export const skillSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  category: z.string().min(1, "Category is required").max(100),
  proficiency: z.number().int().min(0).max(100).default(80),
  yearsExperience: z.number().int().min(0).max(50).optional().nullable(),
  iconName: z.string().max(100).optional().nullable(),
  sortOrder: z.number().int().min(0).max(1000).default(0),
});

export type SkillInput = z.infer<typeof skillSchema>;

// ============================================
// Story Schemas
// ============================================

export const storySchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  slug: z.string().min(1).max(255).regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  summary: z.string().min(1, "Summary is required").max(1000),
  situation: z.string().max(5000).optional().nullable(),
  task: z.string().max(5000).optional().nullable(),
  action: z.string().max(5000).optional().nullable(),
  result: z.string().max(5000).optional().nullable(),
  lessonsLearned: z.string().max(5000).optional().nullable(),
  company: z.string().max(200).optional().nullable(),
  role: z.string().max(200).optional().nullable(),
  date: dateSchema.optional().nullable(),
  tags: z.array(z.string().max(50)).max(20).default([]),
  isFeatured: z.boolean().default(false),
  isPublished: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(1000).default(0),
});

export type StoryInput = z.infer<typeof storySchema>;

// ============================================
// Volunteer Work Schemas
// ============================================

export const volunteerWorkSchema = z.object({
  organization: z.string().min(1, "Organization is required").max(200),
  role: z.string().min(1, "Role is required").max(200),
  location: z.string().max(200).optional().nullable(),
  cause: z.string().max(200).optional().nullable(),
  description: z.string().max(5000).optional().nullable(),
  situation: z.string().max(5000).optional().nullable(),
  task: z.string().max(5000).optional().nullable(),
  action: z.string().max(5000).optional().nullable(),
  result: z.string().max(5000).optional().nullable(),
  startDate: dateSchema.optional().nullable(),
  endDate: dateSchema.optional().nullable(),
  isCurrent: z.boolean().default(false),
  skills: z.array(z.string().max(100)).max(30).default([]),
  websiteUrl: urlSchema,
  isPublished: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(1000).default(0),
});

export type VolunteerWorkInput = z.infer<typeof volunteerWorkSchema>;

// ============================================
// Utility function for validation
// ============================================

export function validateInput<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const errorMessage = result.error.issues
    .map((e) => `${e.path.join(".")}: ${e.message}`)
    .join(", ");
  return { success: false, error: errorMessage };
}
