-- Pre-computed analytics from the Python service.
-- The analytics microservice writes rows; the API reads them via GET /api/insights.

CREATE TABLE IF NOT EXISTS "user_insights" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "insight_type" varchar(50) NOT NULL,
  "exercise_id" varchar(100),
  "payload" jsonb NOT NULL,
  "computed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "valid_until" timestamp with time zone
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_insights_user_type_exercise_idx"
  ON "user_insights" ("user_id", "insight_type", "exercise_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_insights_user_type_idx"
  ON "user_insights" ("user_id", "insight_type");
