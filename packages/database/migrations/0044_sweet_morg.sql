-- Expand phase: old application versions omit family_id, so install the default
-- before backfilling and deliberately leave the column nullable. A later,
-- separately deployed contract migration may enforce NOT NULL after every old
-- writer has been retired and the invariant has been verified.
ALTER TABLE "refresh_tokens" ADD COLUMN "family_id" uuid;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ALTER COLUMN "family_id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD COLUMN "consumed_at" timestamp with time zone;--> statement-breakpoint
UPDATE "refresh_tokens" SET "family_id" = gen_random_uuid() WHERE "family_id" IS NULL;--> statement-breakpoint
CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens" USING btree ("family_id");--> statement-breakpoint
CREATE UNIQUE INDEX "refresh_tokens_one_active_per_family_uq" ON "refresh_tokens" USING btree ("family_id") WHERE "refresh_tokens"."consumed_at" IS NULL;
