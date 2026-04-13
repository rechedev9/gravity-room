CREATE TABLE "exercises" (
  "id" varchar(50) PRIMARY KEY NOT NULL,
  "name" varchar(100) NOT NULL,
  "muscle_group_id" varchar(50) NOT NULL REFERENCES "muscle_groups"("id") ON DELETE RESTRICT,
  "equipment" varchar(50),
  "is_compound" boolean NOT NULL DEFAULT false,
  "is_preset" boolean NOT NULL DEFAULT true,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX "exercises_muscle_group_id_idx" ON "exercises" ("muscle_group_id");--> statement-breakpoint
CREATE INDEX "exercises_created_by_idx" ON "exercises" ("created_by");
