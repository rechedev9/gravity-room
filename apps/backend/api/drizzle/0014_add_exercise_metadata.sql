ALTER TABLE "exercises" ADD COLUMN IF NOT EXISTS "force" varchar(20);--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN IF NOT EXISTS "level" varchar(20);--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN IF NOT EXISTS "mechanic" varchar(20);--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN IF NOT EXISTS "category" varchar(50);--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN IF NOT EXISTS "secondary_muscles" text[];
