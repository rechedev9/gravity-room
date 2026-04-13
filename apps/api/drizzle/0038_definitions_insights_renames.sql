ALTER TABLE "program_definitions" RENAME COLUMN "definition" TO "program_body";
ALTER TABLE "program_templates" RENAME COLUMN "definition" TO "program_body";
ALTER TABLE "program_templates" RENAME COLUMN "source" TO "source_type";
ALTER TABLE "user_insights" RENAME COLUMN "payload" TO "insight_data";
