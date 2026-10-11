-- Per-account weight display unit. Additive and safe on a populated users table:
-- ADD COLUMN with a constant default is a metadata-only change, existing users
-- read 'kg', and an old API artifact that never writes the column keeps working.
-- The check is added NOT VALID then validated so the validation scan does not
-- hold an exclusive lock.
ALTER TABLE "users" ADD COLUMN "weight_unit" varchar(3) DEFAULT 'kg' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "chk_users_weight_unit" CHECK ("users"."weight_unit" IN ('kg', 'lbs')) NOT VALID;--> statement-breakpoint
ALTER TABLE "users" VALIDATE CONSTRAINT "chk_users_weight_unit";
