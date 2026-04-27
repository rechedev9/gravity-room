CREATE TABLE "muscle_groups" (
  "id" varchar(50) PRIMARY KEY NOT NULL,
  "name" varchar(100) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
