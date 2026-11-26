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
  numeric,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Custom pgvector type for 3072-dimensional embeddings (gemini-embedding-001)
const vector = customType<{ data: number[]; driverType: string }>({
  dataType() {
    return "vector(3072)";
  },
  toDriver(value: number[]): string {
    // Validate that all values are finite numbers to prevent injection
    if (!Array.isArray(value)) {
      throw new Error("Vector value must be an array");
    }
    for (let i = 0; i < value.length; i++) {
      const v = value[i];
      if (typeof v !== "number" || !Number.isFinite(v)) {
        throw new Error(`Invalid vector value at index ${i}: must be a finite number`);
      }
    }
    return `[${value.join(",")}]`;
  },
  fromDriver(value: unknown): number[] {
    if (typeof value === "string") {
      return value
        .slice(1, -1)
        .split(",")
        .map((v) => {
          const num = parseFloat(v);
          if (!Number.isFinite(num)) {
            throw new Error(`Invalid vector value in database: ${v}`);
          }
          return num;
        });
    }
    if (Array.isArray(value)) {
      return value.map((v, i) => {
        if (typeof v !== "number" || !Number.isFinite(v)) {
          throw new Error(`Invalid vector value at index ${i}`);
        }
        return v;
      });
    }
    throw new Error("Invalid vector format from database");
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
  articleTitle: text("name").notNull(),
  source: text("issuer").notNull(),
  excerpt: text("credential_id"),
  articleUrl: text("credential_url"),
  publishedDate: date("issue_date").notNull(),
  followUpDate: date("expiration_date"),
  coverImageUrl: text("badge_url"),
  isPublished: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  // Reading list inbox (columns added by lib/reading/setup-sql.ts)
  /** inbox | published | archived. is_active mirrors status === "published". */
  status: text("status").notNull().default("published"),
  /** The public note shown under the article. */
  note: text("note"),
  /** AI-suggested note; never shown publicly. */
  suggestedNote: text("suggested_note"),
  /** Text selected when the article was saved. */
  quote: text("quote"),
  imageUrl: text("image_url"),
  siteName: text("site_name"),
  author: text("author"),
  savedVia: text("saved_via"),
  urlNormalized: text("url_normalized"),
  savedAt: timestamp("saved_at").defaultNow(),
  /** Topics, shared with Thoughts posts (see lib/topics.ts). */
  tags: text("tags").array().notNull().default([]),
  /** AI-suggested topics; never applied without the author choosing them. */
  suggestedTags: text("suggested_tags").array().notNull().default([]),
});

export type ReadingItem = typeof certifications.$inferSelect;

// Personal API tokens (e.g. the iPhone "Save to Reading" Shortcut). Only the
// SHA-256 of a token is stored; the token itself is shown once.
export const apiTokens = pgTable("api_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  scope: text("scope").notNull(),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  revokedAt: timestamp("revoked_at"),
});

export type ApiToken = typeof apiTokens.$inferSelect;

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
// Rate Limiting
// ============================================

export const rateLimitRequests = pgTable(
  "rate_limit_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ipAddress: varchar("ip_address", { length: 45 }).notNull(),
    route: varchar("route", { length: 100 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    ipRouteCreatedIdx: index("rate_limit_ip_route_created_idx").on(
      table.ipAddress,
      table.route,
      table.createdAt
    ),
  })
);

// ============================================
// Writing Studio (private drafts for Thoughts)
// ============================================
// The `stories` table stays the live, public copy. A writing document is the
// private working draft; publishing copies it into its linked story row.

export const WRITING_STATUSES = ["IDEA", "DRAFT", "IN_REVIEW", "READY_TO_PUBLISH", "PUBLISHED", "ARCHIVED"] as const;
export type WritingStatus = (typeof WRITING_STATUSES)[number];

export const REVISION_ORIGINS = ["import", "autosave", "manual", "restore", "publish", "pull_live", "before_ai", "ai_accept"] as const;
export type RevisionOrigin = (typeof REVISION_ORIGINS)[number];

/** Tiptap/ProseMirror document JSON. */
export type EditorJSON = { type: "doc"; content?: unknown[] };

export const writingDocuments = pgTable(
  "writing_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerEmail: text("owner_email").notNull(),
    title: text("title").notNull().default(""),
    slug: varchar("slug", { length: 255 }),
    excerpt: text("excerpt").notNull().default(""),
    status: text("status").notNull().default("DRAFT").$type<WritingStatus>(),
    bodyJson: jsonb("body_json").notNull().$type<EditorJSON>(),
    bodyText: text("body_text").notNull().default(""),
    wordCount: integer("word_count").notNull().default(0),
    tags: text("tags").array().notNull().default([]),
    postDate: date("post_date"),
    // Writing style the AI follows for this post (null = the default style)
    styleId: uuid("style_id"),
    // Compare-and-swap token: every content save must name the revision it edited
    currentRevision: integer("current_revision").notNull().default(1),
    publishedRevision: integer("published_revision"),
    // The public row this document publishes to (set for imported posts too)
    storyId: uuid("story_id")
      .unique()
      .references(() => stories.id, { onDelete: "set null" }),
    source: text("source").notNull().default("studio").$type<"studio" | "legacy_import">(),
    publishedAt: timestamp("published_at"),
    // When the draft and its story row were last known to match (import or publish)
    storySyncedAt: timestamp("story_synced_at"),
    lastSnapshotAt: timestamp("last_snapshot_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    statusIdx: index("writing_documents_status_idx").on(table.status),
    updatedIdx: index("writing_documents_updated_idx").on(table.updatedAt),
  })
);

export const writingRevisions = pgTable(
  "writing_revisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => writingDocuments.id, { onDelete: "cascade" }),
    revisionNumber: integer("revision_number").notNull(),
    title: text("title").notNull().default(""),
    excerpt: text("excerpt").notNull().default(""),
    bodyJson: jsonb("body_json").notNull().$type<EditorJSON>(),
    wordCount: integer("word_count").notNull().default(0),
    changeOrigin: text("change_origin").notNull().$type<RevisionOrigin>(),
    // Original HTML for imported posts, kept so nothing is lost in conversion
    legacyHtml: text("legacy_html"),
    // Published snapshot metadata (publish revisions only)
    publishedSlug: varchar("published_slug", { length: 255 }),
    idempotencyKey: text("idempotency_key").unique(),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    documentIdx: index("writing_revisions_document_idx").on(table.documentId, table.createdAt),
  })
);

/** A writing style's rules, written by the author. All fields optional. */
export interface StyleRules {
  voice?: string;
  sentences?: string;
  structure?: string;
  avoid?: string[];
  other?: string;
}

export const writingStyles = pgTable("writing_styles", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  rules: jsonb("rules").notNull().$type<StyleRules>(),
  // Writing documents whose text shows this voice (up to 2)
  exampleDocumentIds: uuid("example_document_ids").array().notNull().default([]),
  isDefault: boolean("is_default").notNull().default(false),
  version: integer("version").notNull().default(1),
  archived: boolean("archived").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const writingStyleVersions = pgTable(
  "writing_style_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    styleId: uuid("style_id")
      .notNull()
      .references(() => writingStyles.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    rules: jsonb("rules").notNull().$type<StyleRules>(),
    exampleDocumentIds: uuid("example_document_ids").array().notNull().default([]),
    createdBy: text("created_by"),
    // Where this version came from, e.g. "Learned from feedback (approved by …)"
    note: text("note"),
    sourceRunId: uuid("source_run_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    styleIdx: index("writing_style_versions_style_idx").on(table.styleId, table.version),
  })
);

// "modified": accepted after the author edited the proposal
export const SUGGESTION_STATUSES = ["pending", "accepted", "modified", "rejected", "stale", "cancelled"] as const;
export type SuggestionStatus = (typeof SUGGESTION_STATUSES)[number];

export const writingSuggestions = pgTable(
  "writing_suggestions",
  {
    id: uuid("id").primaryKey(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => writingDocuments.id, { onDelete: "cascade" }),
    baseRevision: integer("base_revision").notNull(),
    operation: text("operation").notNull(),
    instruction: text("instruction"),
    styleId: uuid("style_id"),
    styleVersion: integer("style_version"),
    originalHtml: text("original_html").notNull(),
    proposalHtml: text("proposal_html").notNull().default(""),
    // What actually went into the post (the author may tweak a suggestion later)
    finalHtml: text("final_html"),
    status: text("status").notNull().default("pending").$type<SuggestionStatus>(),
    // Why the author rejected it (optional): the strongest signal for learning
    reason: text("reason"),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    promptVersion: text("prompt_version").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    resolvedAt: timestamp("resolved_at"),
  },
  (table) => ({
    documentIdx: index("writing_suggestions_document_idx").on(table.documentId, table.createdAt),
  })
);

export const writingAiUsage = pgTable(
  "writing_ai_usage",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    operation: text("operation").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    // US dollars, from the prices in AI settings at the time of the call
    costUsd: numeric("cost_usd", { precision: 12, scale: 6 }).notNull().default("0"),
    // True when the provider didn't report usage (e.g. a cancelled stream)
    estimated: boolean("estimated").notNull().default(false),
    suggestionId: uuid("suggestion_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    createdIdx: index("writing_ai_usage_created_idx").on(table.createdAt),
  })
);

// ---- M4: writing samples ----

export const writingSamples = pgTable(
  "writing_samples",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    content: text("content").notNull(),
    label: text("label").notNull().default(""),
    // Provenance: which post it was taken from, if any
    sourceDocumentId: uuid("source_document_id"),
    sourceTitle: text("source_title").notNull().default(""),
    note: text("note").notNull().default(""),
    // Styles this sample illustrates (empty = any style)
    styleIds: uuid("style_ids").array().notNull().default([]),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    createdIdx: index("writing_samples_created_idx").on(table.createdAt),
  })
);

// ---- M3: ideas, agent runs, research sources, chat ----

export const writingIdeas = pgTable(
  "writing_ideas",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // The original capture; never edited by the AI
    content: text("content").notNull(),
    tags: text("tags").array().notNull().default([]),
    status: text("status").notNull().default("new").$type<"new" | "converted" | "archived">(),
    linkedDocumentId: uuid("linked_document_id"),
    /** Where an idea came from when a run created it, e.g. "reading:<id>" (unique). */
    sourceRef: text("source_ref"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    statusIdx: index("writing_ideas_status_idx").on(table.status, table.createdAt),
  })
);

export const RUN_STATUSES = [
  "CREATED",
  "RUNNING",
  "WAITING_FOR_APPROVAL",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];
export type RunOrigin = "manual" | "cron" | "event";
export type AutonomyLevel = "L0" | "L1" | "L2";

export interface RunUsage {
  modelCalls: number;
  toolCalls: number;
  /** Web pages read (web.fetch); counted separately from searches. */
  fetches?: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export interface RunBudget {
  maxModelCalls: number;
  maxToolCalls: number;
  /** Web pages a run may read (agent runs); default 8. */
  maxFetches?: number;
  maxCostUsd: number;
  maxDurationMs: number;
}

export interface PendingApproval {
  stepIndex: number;
  kind: string;
  title: string;
  /** What the author chooses from or reviews. */
  proposal: unknown;
  /** Agent runs: approving this completes the run. */
  final?: boolean;
}

export const writingAgentRuns = pgTable(
  "writing_agent_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workflow: text("workflow").notNull(),
    status: text("status").notNull().default("CREATED").$type<RunStatus>(),
    documentId: uuid("document_id"),
    ideaId: uuid("idea_id"),
    input: jsonb("input").notNull().$type<Record<string, unknown>>(),
    // Outputs of completed steps, by step id
    state: jsonb("state").notNull().$type<Record<string, unknown>>(),
    currentStep: integer("current_step").notNull().default(0),
    pendingApproval: jsonb("pending_approval").$type<PendingApproval | null>(),
    result: jsonb("result").$type<Record<string, unknown> | null>(),
    budget: jsonb("budget").notNull().$type<RunBudget>(),
    usage: jsonb("usage").notNull().$type<RunUsage>(),
    error: text("error"),
    cancelRequested: boolean("cancel_requested").notNull().default(false),
    /** How the run started: a click, a schedule or an event (agent PRD A0). */
    origin: text("origin").notNull().default("manual").$type<RunOrigin>(),
    /** Time spent executing steps, excluding time waiting for the author. */
    activeMs: integer("active_ms").notNull().default(0),
    /** Agent runs (A2): the goal in plain words. */
    goal: text("goal"),
    /** The trigger that started it (A1); null for a click. */
    triggerId: uuid("trigger_id"),
    /** L0 suggest · L1 draft · L2 act and report (PRD autonomy levels). */
    autonomyLevel: text("autonomy_level").notNull().default("L1").$type<AutonomyLevel>(),
    /** What executes its steps: Vercel Workflow, an in-process loop, or the open tab. */
    driver: text("driver").notNull().default("browser").$type<"workflow" | "inline" | "browser">(),
    // Only one request may execute a step at a time
    lockToken: uuid("lock_token"),
    lockedAt: timestamp("locked_at"),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    finishedAt: timestamp("finished_at"),
  },
  (table) => ({
    documentIdx: index("writing_agent_runs_document_idx").on(table.documentId, table.createdAt),
    createdIdx: index("writing_agent_runs_created_idx").on(table.createdAt),
  })
);

/** One agent tool call (agent PRD A2): what the model chose, with what, and what came back. */
export const writingToolCalls = pgTable(
  "writing_tool_calls",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id")
      .notNull()
      .references(() => writingAgentRuns.id, { onDelete: "cascade" }),
    turn: integer("turn").notNull(),
    tool: text("tool").notNull(),
    args: jsonb("args").notNull().$type<Record<string, unknown>>(),
    argsHash: text("args_hash").notNull(),
    ok: boolean("ok").notNull(),
    error: text("error"),
    resultExcerpt: text("result_excerpt").notNull().default(""),
    resultHash: text("result_hash"),
    ms: integer("ms").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({ runIdx: index("writing_tool_calls_run_idx").on(table.runId, table.turn) })
);

/** A schedule or event that starts agent runs (agent PRD A1). */
export const writingTriggers = pgTable("writing_triggers", {
  id: uuid("id").defaultRandom().primaryKey(),
  /** Stable key for built-in triggers (seeded once). */
  key: text("key").unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  kind: text("kind").notNull().$type<"cron" | "event">(),
  /** 5-field cron expression in `timezone`. */
  schedule: text("schedule"),
  timezone: text("timezone").notNull().default("America/Los_Angeles"),
  event: text("event").$type<AgentEventName | null>(),
  /** A1: the scripted workflow to run. A2+: the agent playbook. */
  workflow: text("workflow").notNull(),
  goalTemplate: text("goal_template").notNull().default(""),
  inputTemplate: jsonb("input_template").notNull().$type<Record<string, unknown>>().default({}),
  autonomyLevel: text("autonomy_level").notNull().default("L1").$type<AutonomyLevel>(),
  dailyBudgetUsd: numeric("daily_budget_usd", { precision: 8, scale: 4 }).notNull().default("0.5"),
  enabled: boolean("enabled").notNull().default(false),
  nextRunAt: timestamp("next_run_at"),
  lastFiredAt: timestamp("last_fired_at"),
  lastRunId: uuid("last_run_id"),
  lastStatus: text("last_status"),
  consecutiveFailures: integer("consecutive_failures").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type WritingTrigger = typeof writingTriggers.$inferSelect;
export type AgentEventName = "reading.saved" | "publish.opened";

/** One row per firing; (trigger, fire key) is unique, so duplicate cron calls and events are no-ops. */
export const writingTriggerFires = pgTable("writing_trigger_fires", {
  id: uuid("id").defaultRandom().primaryKey(),
  triggerId: uuid("trigger_id")
    .notNull()
    .references(() => writingTriggers.id, { onDelete: "cascade" }),
  fireKey: text("fire_key").notNull(),
  runId: uuid("run_id"),
  outcome: text("outcome").notNull().default("started"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const writingAgentEvents = pgTable(
  "writing_agent_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id")
      .notNull()
      .references(() => writingAgentRuns.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    message: text("message").notNull().default(""),
    payload: jsonb("payload").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    runIdx: index("writing_agent_events_run_idx").on(table.runId, table.createdAt),
  })
);

export const writingApprovals = pgTable("writing_approvals", {
  id: uuid("id").defaultRandom().primaryKey(),
  runId: uuid("run_id")
    .notNull()
    .references(() => writingAgentRuns.id, { onDelete: "cascade" }),
  stepIndex: integer("step_index").notNull(),
  kind: text("kind").notNull(),
  decision: jsonb("decision").notNull().$type<Record<string, unknown>>(),
  approvedBy: text("approved_by").notNull(),
  // Repeating the same approval (double click, retry) is a no-op
  idempotencyKey: text("idempotency_key").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const writingSources = pgTable(
  "writing_sources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id"),
    runId: uuid("run_id"),
    url: text("url").notNull(),
    title: text("title").notNull().default(""),
    publisher: text("publisher").notNull().default(""),
    publishedDate: text("published_date"),
    // Text actually returned by the search provider (the evidence)
    excerpt: text("excerpt").notNull().default(""),
    contentHash: text("content_hash").notNull(),
    query: text("query").notNull().default(""),
    provider: text("provider").notNull().default("tavily"),
    retrievedAt: timestamp("retrieved_at").defaultNow().notNull(),
  },
  (table) => ({
    documentIdx: index("writing_sources_document_idx").on(table.documentId, table.retrievedAt),
  })
);

// Weekly reading list (agent PRD A3). The nightly agent keeps a shortlist of
// articles it found on the author's topics; the weekly agent turns it into a
// list the author approves before it's published. Created by agent/setup-sql.ts.
export const readingCandidates = pgTable(
  "reading_candidates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    url: text("url").notNull(),
    urlNormalized: text("url_normalized").notNull().unique(),
    title: text("title").notNull().default(""),
    publisher: text("publisher").notNull().default(""),
    publishedDate: text("published_date"),
    topic: text("topic").notNull().default(""),
    excerpt: text("excerpt").notNull().default(""),
    /** 0–10 overall, from the rubric's parts. */
    score: numeric("score", { precision: 4, scale: 2 }).notNull().default("0"),
    scores: jsonb("scores").$type<Record<string, number>>().notNull().default({}),
    reason: text("reason").notNull().default(""),
    /** Whether the agent read the page in full before scoring it. */
    readInFull: boolean("read_in_full").notNull().default(false),
    /** active | dropped | picked */
    status: text("status").notNull().default("active"),
    runId: uuid("run_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    statusIdx: index("reading_candidates_status_idx").on(table.status, table.createdAt),
  })
);

export interface WeeklyPick {
  title: string;
  url: string;
  publisher: string;
  topic: string;
  /** One line on why it's worth reading (the author approves it). */
  line: string;
  candidateId?: string | null;
  readingItemId?: string | null;
}

export const readingWeeklyLists = pgTable("reading_weekly_lists", {
  id: uuid("id").defaultRandom().primaryKey(),
  /** ISO week, e.g. 2026-W48. One list per week. */
  week: text("week").notNull().unique(),
  title: text("title").notNull().default(""),
  intro: text("intro").notNull().default(""),
  picks: jsonb("picks").$type<WeeklyPick[]>().notNull().default([]),
  runId: uuid("run_id"),
  publishedAt: timestamp("published_at").defaultNow().notNull(),
});

export type ReadingCandidate = typeof readingCandidates.$inferSelect;
export type ReadingWeeklyList = typeof readingWeeklyLists.$inferSelect;

export const writingConversations = pgTable(
  "writing_conversations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => writingDocuments.id, { onDelete: "cascade" }),
    title: text("title").notNull().default(""),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    documentIdx: index("writing_conversations_document_idx").on(table.documentId, table.updatedAt),
  })
);

export const writingMessages = pgTable(
  "writing_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => writingConversations.id, { onDelete: "cascade" }),
    role: text("role").notNull().$type<"user" | "assistant">(),
    content: text("content").notNull(),
    model: text("model"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    conversationIdx: index("writing_messages_conversation_idx").on(table.conversationId, table.createdAt),
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
export type WritingDocument = typeof writingDocuments.$inferSelect;
export type WritingRevision = typeof writingRevisions.$inferSelect;
export type WritingStyle = typeof writingStyles.$inferSelect;
export type WritingSuggestion = typeof writingSuggestions.$inferSelect;
export type WritingIdea = typeof writingIdeas.$inferSelect;
export type WritingSample = typeof writingSamples.$inferSelect;
export type WritingAgentRun = typeof writingAgentRuns.$inferSelect;
export type WritingAgentEvent = typeof writingAgentEvents.$inferSelect;
export type WritingSource = typeof writingSources.$inferSelect;
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
