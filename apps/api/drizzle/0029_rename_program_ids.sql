-- Rename program IDs to match their display names as URL-friendly slugs.
-- Updates both program_templates (source of truth) and program_instances (user data).
-- Must drop FK constraint first since Drizzle runs migrations in a transaction.

ALTER TABLE "program_instances" DROP CONSTRAINT IF EXISTS "program_instances_program_id_fk";--> statement-breakpoint

UPDATE "program_templates" SET "id" = 'furia-oscura' WHERE "id" = 'ppl-ab';--> statement-breakpoint
UPDATE "program_templates" SET "id" = 'hexan-ppl' WHERE "id" = 'ppl531';--> statement-breakpoint
UPDATE "program_templates" SET "id" = 'caparazon-de-tortuga' WHERE "id" = 'mutenroshi';--> statement-breakpoint
UPDATE "program_templates" SET "id" = 'stronglifts-5x5' WHERE "id" = 'stronglifts5x5';--> statement-breakpoint
UPDATE "program_templates" SET "id" = 'phraks-greyskull-lp' WHERE "id" = 'phraks-gslp';--> statement-breakpoint
UPDATE "program_templates" SET "id" = '531-boring-but-big' WHERE "id" = 'wendler531bbb';--> statement-breakpoint
UPDATE "program_templates" SET "id" = '531-for-beginners' WHERE "id" = 'wendler531beginners';--> statement-breakpoint
UPDATE "program_templates" SET "id" = 'nivel-7' WHERE "id" = 'nivel7';--> statement-breakpoint
UPDATE "program_templates" SET "id" = 'tenkaichi-budokai-sentadilla' WHERE "id" = 'sheiko-7-1';--> statement-breakpoint
UPDATE "program_templates" SET "id" = 'tenkaichi-budokai-press-banca' WHERE "id" = 'sheiko-7-2';--> statement-breakpoint
UPDATE "program_templates" SET "id" = 'tenkaichi-budokai-peso-muerto' WHERE "id" = 'sheiko-7-3';--> statement-breakpoint
UPDATE "program_templates" SET "id" = 'tenkaichi-budokai-solo-banca' WHERE "id" = 'sheiko-7-4';--> statement-breakpoint
UPDATE "program_templates" SET "id" = 'tenkaichi-budokai-veterano' WHERE "id" = 'sheiko-7-5';--> statement-breakpoint
UPDATE "program_templates" SET "id" = '365-programmare-lipertrofia' WHERE "id" = 'brunetti-365';--> statement-breakpoint
UPDATE "program_templates" SET "id" = 'la-sala-del-tiempo' WHERE "id" = 'brunetti-365-exp';--> statement-breakpoint

UPDATE "program_instances" SET "program_id" = 'furia-oscura' WHERE "program_id" = 'ppl-ab';--> statement-breakpoint
UPDATE "program_instances" SET "program_id" = 'hexan-ppl' WHERE "program_id" = 'ppl531';--> statement-breakpoint
UPDATE "program_instances" SET "program_id" = 'caparazon-de-tortuga' WHERE "program_id" = 'mutenroshi';--> statement-breakpoint
UPDATE "program_instances" SET "program_id" = 'stronglifts-5x5' WHERE "program_id" = 'stronglifts5x5';--> statement-breakpoint
UPDATE "program_instances" SET "program_id" = 'phraks-greyskull-lp' WHERE "program_id" = 'phraks-gslp';--> statement-breakpoint
UPDATE "program_instances" SET "program_id" = '531-boring-but-big' WHERE "program_id" = 'wendler531bbb';--> statement-breakpoint
UPDATE "program_instances" SET "program_id" = '531-for-beginners' WHERE "program_id" = 'wendler531beginners';--> statement-breakpoint
UPDATE "program_instances" SET "program_id" = 'nivel-7' WHERE "program_id" = 'nivel7';--> statement-breakpoint
UPDATE "program_instances" SET "program_id" = 'tenkaichi-budokai-sentadilla' WHERE "program_id" = 'sheiko-7-1';--> statement-breakpoint
UPDATE "program_instances" SET "program_id" = 'tenkaichi-budokai-press-banca' WHERE "program_id" = 'sheiko-7-2';--> statement-breakpoint
UPDATE "program_instances" SET "program_id" = 'tenkaichi-budokai-peso-muerto' WHERE "program_id" = 'sheiko-7-3';--> statement-breakpoint
UPDATE "program_instances" SET "program_id" = 'tenkaichi-budokai-solo-banca' WHERE "program_id" = 'sheiko-7-4';--> statement-breakpoint
UPDATE "program_instances" SET "program_id" = 'tenkaichi-budokai-veterano' WHERE "program_id" = 'sheiko-7-5';--> statement-breakpoint
UPDATE "program_instances" SET "program_id" = '365-programmare-lipertrofia' WHERE "program_id" = 'brunetti-365';--> statement-breakpoint
UPDATE "program_instances" SET "program_id" = 'la-sala-del-tiempo' WHERE "program_id" = 'brunetti-365-exp';--> statement-breakpoint

ALTER TABLE "program_instances" ADD CONSTRAINT "program_instances_program_id_fk" FOREIGN KEY ("program_id") REFERENCES "program_templates"("id") ON DELETE no action ON UPDATE no action;
