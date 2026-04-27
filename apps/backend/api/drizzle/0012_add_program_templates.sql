CREATE TABLE "program_templates" (
  "id" varchar(50) PRIMARY KEY NOT NULL,
  "name" varchar(100) NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "author" varchar(100) NOT NULL DEFAULT '',
  "version" smallint NOT NULL DEFAULT 1,
  "category" varchar(50) NOT NULL DEFAULT 'strength',
  "source" varchar(10) NOT NULL DEFAULT 'preset',
  "definition" jsonb NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX "program_templates_is_active_idx" ON "program_templates" ("is_active");
