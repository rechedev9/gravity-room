CREATE TYPE "public"."instance_status" AS ENUM('active', 'completed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."result_type" AS ENUM('success', 'fail');--> statement-breakpoint
CREATE TABLE "program_instances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"program_id" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"config" jsonb NOT NULL,
	"status" "instance_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refresh_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "undo_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"instance_id" uuid NOT NULL,
	"workout_index" smallint NOT NULL,
	"slot_id" varchar(20) NOT NULL,
	"prev_result" "result_type",
	"prev_amrap_reps" smallint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"name" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "workout_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"instance_id" uuid NOT NULL,
	"workout_index" smallint NOT NULL,
	"slot_id" varchar(20) NOT NULL,
	"result" "result_type" NOT NULL,
	"amrap_reps" smallint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workout_results_instance_slot_idx" UNIQUE("instance_id","workout_index","slot_id")
);
--> statement-breakpoint
ALTER TABLE "program_instances" ADD CONSTRAINT "program_instances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "undo_entries" ADD CONSTRAINT "undo_entries_instance_id_program_instances_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."program_instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_results" ADD CONSTRAINT "workout_results_instance_id_program_instances_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."program_instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "program_instances_user_status_idx" ON "program_instances" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "undo_entries_instance_id_idx" ON "undo_entries" USING btree ("instance_id");--> statement-breakpoint
CREATE INDEX "workout_results_instance_id_idx" ON "workout_results" USING btree ("instance_id");