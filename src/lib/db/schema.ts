import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  boolean,
  jsonb,
  varchar,
  date,
  index,
  unique,
  customType,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Custom pgvector type for 3072-dimensional embeddings (gemini-embedding-001)
const vector = customType<{ data: number[]; driverType: string }>({
  dataType() {
    return "vector(3072)";
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
  fromDriver(value: unknown): number[] {
    if (typeof value === "string") {
      return value
        .slice(1, -1)
        .split(",")
        .map((v) => parseFloat(v));
    }
    return value as number[];
  },
});

// ============================================
// Documents & Embeddings
// ============================================

export const documents = pgTable("documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  fileSize: integer("file_size").notNull(),
  storagePath: text("storage_path").notNull(),
  category: text("category").notNull().default("general"),
  isActive: boolean("is_active").notNull().default(true),
  uploadedBy: text("uploaded_by"),
  processedAt: timestamp("processed_at"),
  chunkCount: integer("chunk_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const documentChunks = pgTable(
  "document_chunks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    tokenCount: integer("token_count").notNull(),
    embedding: vector("embedding"),
    metadata: jsonb("metadata").$type<{
      pageNumber?: number;
      section?: string;
      heading?: string;
    }>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    documentIdIdx: index("document_chunks_document_id_idx").on(table.documentId),
    chunkIndexIdx: index("document_chunks_chunk_index_idx").on(
      table.documentId,
      table.chunkIndex
    ),
  })
);

// ============================================
// Projects (STAR Format)
// ============================================

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: varchar("slug", { length: 255 }).notNull().unique(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    thumbnailUrl: text("thumbnail_url"),
    websiteUrl: text("website_url"),
    situation: text("situation"),
    task: text("task"),
    action: text("action"),
    result: text("result"),
    lessonsLearned: text("lessons_learned"),
    technologies: text("technologies").array().notNull().default([]),
    company: text("company"),
    role: text("role"),
    startDate: date("start_date"),
    endDate: date("end_date"),
    isFeatured: boolean("is_featured").notNull().default(false),
    isPublished: boolean("is_published").notNull().default(false),
    sortOrder: integer("sort_order").default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    slugIdx: index("projects_slug_idx").on(table.slug),
    featuredIdx: index("projects_featured_idx").on(table.isFeatured),
  })
);

// ============================================
// Experience
// ============================================

export const experiences = pgTable(
  "experiences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    company: text("company").notNull(),
    title: text("title").notNull(),
    location: text("location"),
    employmentType: text("employment_type").notNull().default("full-time"),
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),
    isCurrent: boolean("is_current").notNull().default(false),
    description: text("description"),
    achievements: text("achievements").array().default([]),
    technologies: text("technologies").array().default([]),
    companyLogo: text("company_logo"),
    sortOrder: integer("sort_order").default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    currentIdx: index("experiences_current_idx").on(table.isCurrent),
    sortOrderIdx: index("experiences_sort_order_idx").on(table.sortOrder),
  })
);

// ============================================
// Certifications
// ============================================

export const certifications = pgTable("certifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  issuer: text("issuer").notNull(),
  credentialId: text("credential_id"),
  credentialUrl: text("credential_url"),
  issueDate: date("issue_date").notNull(),
  expirationDate: date("expiration_date"),
  badgeUrl: text("badge_url"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================
// Skills
// ============================================

export const skills = pgTable("skills", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  proficiency: integer("proficiency").default(80),
  yearsExperience: integer("years_experience"),
  iconName: text("icon_name"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================
// Stories (Work-related STAR format stories)
// ============================================

export const stories = pgTable(
  "stories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    slug: varchar("slug", { length: 255 }).notNull().unique(),
    summary: text("summary").notNull(),
    situation: text("situation"),
    task: text("task"),
    action: text("action"),
    result: text("result"),
    lessonsLearned: text("lessons_learned"),
    company: text("company"),
    role: text("role"),
    date: date("date"),
    tags: text("tags").array().default([]),
    isFeatured: boolean("is_featured").notNull().default(false),
    isPublished: boolean("is_published").notNull().default(false),
    sortOrder: integer("sort_order").default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    slugIdx: index("stories_slug_idx").on(table.slug),
    featuredIdx: index("stories_featured_idx").on(table.isFeatured),
  })
);

// ============================================
// Volunteer Work
// ============================================

export const volunteerWork = pgTable(
  "volunteer_work",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organization: text("organization").notNull(),
    role: text("role").notNull(),
    location: text("location"),
    cause: text("cause"),
    description: text("description"),
    situation: text("situation"),
    task: text("task"),
    action: text("action"),
    result: text("result"),
    startDate: date("start_date"),
    endDate: date("end_date"),
    isCurrent: boolean("is_current").notNull().default(false),
    skills: text("skills").array().default([]),
    websiteUrl: text("website_url"),
    isPublished: boolean("is_published").notNull().default(false),
    sortOrder: integer("sort_order").default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    currentIdx: index("volunteer_work_current_idx").on(table.isCurrent),
    sortOrderIdx: index("volunteer_work_sort_order_idx").on(table.sortOrder),
  })
);

// ============================================
// Chat Sessions & Messages
// ============================================

export const chatSessions = pgTable(
  "chat_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    visitorId: text("visitor_id"),
    metadata: jsonb("metadata").$type<{
      userAgent?: string;
      ip?: string;
      referrer?: string;
      country?: string;
    }>(),
    totalMessages: integer("total_messages").default(0),
    totalTokens: integer("total_tokens").default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    visitorIdIdx: index("chat_sessions_visitor_id_idx").on(table.visitorId),
    createdAtIdx: index("chat_sessions_created_at_idx").on(table.createdAt),
  })
);

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => chatSessions.id, { onDelete: "cascade" }),
    role: text("role").notNull().$type<"user" | "assistant" | "system">(),
    content: text("content").notNull(),
    promptTokens: integer("prompt_tokens").default(0),
    completionTokens: integer("completion_tokens").default(0),
    retrievedChunks: jsonb("retrieved_chunks").$type<
      Array<{
        chunkId: string;
        similarity: number;
        content: string;
      }>
    >(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    sessionIdIdx: index("chat_messages_session_id_idx").on(table.sessionId),
    createdAtIdx: index("chat_messages_created_at_idx").on(table.createdAt),
  })
);

// ============================================
// Token Usage Analytics
// ============================================

export const tokenUsage = pgTable(
  "token_usage",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    date: date("date").notNull(),
    model: text("model").notNull(),
    operation: text("operation").notNull().$type<"chat" | "embedding" | "fit-assessment">(),
    promptTokens: integer("prompt_tokens").notNull().default(0),
    completionTokens: integer("completion_tokens").notNull().default(0),
    requestCount: integer("request_count").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    dateIdx: index("token_usage_date_idx").on(table.date),
    modelIdx: index("token_usage_model_idx").on(table.model),
    operationIdx: index("token_usage_operation_idx").on(table.operation),
    dateModelOperationUnique: unique("token_usage_date_model_operation_unique").on(
      table.date,
      table.model,
      table.operation
    ),
  })
);

// ============================================
// Admin Users
// ============================================

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  name: text("name"),
  image: text("image"),
  googleId: text("google_id").unique(),
  role: text("role").notNull().default("admin").$type<"admin" | "viewer">(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================
// Site Settings (Configurable Content)
// ============================================

export const siteSettings = pgTable("site_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: text("key").notNull().unique(),
  value: jsonb("value").notNull(),
  category: text("category").notNull().default("general"),
  label: text("label"),
  description: text("description"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: text("updated_by"),
});

// ============================================
// Visitor Analytics
// ============================================

export const visitors = pgTable(
  "visitors",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    visitorId: text("visitor_id").notNull(),
    path: text("path").notNull(),
    referrer: text("referrer"),
    userAgent: text("user_agent"),
    country: text("country"),
    visitedAt: timestamp("visited_at").defaultNow().notNull(),
  },
  (table) => ({
    visitorIdIdx: index("visitors_visitor_id_idx").on(table.visitorId),
    visitedAtIdx: index("visitors_visited_at_idx").on(table.visitedAt),
  })
);

// ============================================
// Relations
// ============================================

export const documentsRelations = relations(documents, ({ many }) => ({
  chunks: many(documentChunks),
}));

export const documentChunksRelations = relations(documentChunks, ({ one }) => ({
  document: one(documents, {
    fields: [documentChunks.documentId],
    references: [documents.id],
  }),
}));

export const chatSessionsRelations = relations(chatSessions, ({ many }) => ({
  messages: many(chatMessages),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  session: one(chatSessions, {
    fields: [chatMessages.sessionId],
    references: [chatSessions.id],
  }),
}));

// ============================================
// Types
// ============================================

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type DocumentChunk = typeof documentChunks.$inferSelect;
export type NewDocumentChunk = typeof documentChunks.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Experience = typeof experiences.$inferSelect;
export type NewExperience = typeof experiences.$inferInsert;
export type Certification = typeof certifications.$inferSelect;
export type NewCertification = typeof certifications.$inferInsert;
export type Skill = typeof skills.$inferSelect;
export type NewSkill = typeof skills.$inferInsert;
export type Story = typeof stories.$inferSelect;
export type NewStory = typeof stories.$inferInsert;
export type VolunteerWork = typeof volunteerWork.$inferSelect;
export type NewVolunteerWork = typeof volunteerWork.$inferInsert;
export type ChatSession = typeof chatSessions.$inferSelect;
export type NewChatSession = typeof chatSessions.$inferInsert;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type NewChatMessage = typeof chatMessages.$inferInsert;
export type TokenUsage = typeof tokenUsage.$inferSelect;
export type NewTokenUsage = typeof tokenUsage.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type SiteSetting = typeof siteSettings.$inferSelect;
export type NewSiteSetting = typeof siteSettings.$inferInsert;
export type Visitor = typeof visitors.$inferSelect;
export type NewVisitor = typeof visitors.$inferInsert;
