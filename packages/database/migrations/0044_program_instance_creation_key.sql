ALTER TABLE "program_instances" ADD COLUMN "creation_key" varchar(36);--> statement-breakpoint
CREATE UNIQUE INDEX "program_instances_user_creation_key_idx" ON "program_instances" USING btree ("user_id", "creation_key");
