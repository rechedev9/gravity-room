ALTER TABLE "refresh_tokens" ADD COLUMN "previous_token_hash" varchar(64);--> statement-breakpoint
CREATE INDEX "refresh_tokens_prev_hash_idx" ON "refresh_tokens" USING btree ("previous_token_hash");