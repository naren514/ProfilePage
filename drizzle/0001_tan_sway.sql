ALTER TABLE "projects" ADD COLUMN "website_url" text;--> statement-breakpoint
ALTER TABLE "token_usage" ADD CONSTRAINT "token_usage_date_model_operation_unique" UNIQUE("date","model","operation");