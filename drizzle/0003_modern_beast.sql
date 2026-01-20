CREATE TABLE "stories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"slug" varchar(255) NOT NULL,
	"summary" text NOT NULL,
	"situation" text,
	"task" text,
	"action" text,
	"result" text,
	"lessons_learned" text,
	"company" text,
	"role" text,
	"date" date,
	"tags" text[] DEFAULT '{}',
	"is_featured" boolean DEFAULT false NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "volunteer_work" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization" text NOT NULL,
	"role" text NOT NULL,
	"location" text,
	"cause" text,
	"description" text,
	"situation" text,
	"task" text,
	"action" text,
	"result" text,
	"start_date" date,
	"end_date" date,
	"is_current" boolean DEFAULT false NOT NULL,
	"skills" text[] DEFAULT '{}',
	"website_url" text,
	"is_published" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "stories_slug_idx" ON "stories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "stories_featured_idx" ON "stories" USING btree ("is_featured");--> statement-breakpoint
CREATE INDEX "volunteer_work_current_idx" ON "volunteer_work" USING btree ("is_current");--> statement-breakpoint
CREATE INDEX "volunteer_work_sort_order_idx" ON "volunteer_work" USING btree ("sort_order");