CREATE SEQUENCE "refresh_token_family_order_seq";--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD COLUMN "family_id" uuid DEFAULT gen_random_uuid();--> statement-breakpoint
UPDATE "refresh_tokens" SET "family_id" = "id" WHERE "family_id" IS NULL;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ALTER COLUMN "family_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD COLUMN "family_order" bigint DEFAULT nextval('"refresh_token_family_order_seq"');--> statement-breakpoint
UPDATE "refresh_tokens" SET "family_order" = nextval('"refresh_token_family_order_seq"') WHERE "family_order" IS NULL;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ALTER COLUMN "family_order" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD COLUMN "consumed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD COLUMN "superseded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD COLUMN "family_lookup_expires_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "refresh_tokens_family_lookup_expires_at_idx" ON "refresh_tokens" USING btree ("family_lookup_expires_at");
