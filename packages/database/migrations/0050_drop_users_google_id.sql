INSERT INTO "user_identities" ("user_id", "provider", "provider_account_id")
SELECT "id", 'google', "google_id" FROM "users" WHERE "google_id" IS NOT NULL
ON CONFLICT ("provider", "provider_account_id") DO NOTHING;--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_google_id_unique";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "google_id";
