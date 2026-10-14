ALTER TABLE "user_identities" ADD CONSTRAINT "user_identities_provider_chk" CHECK ("provider" IN ('google', 'apple', 'github', 'microsoft', 'password')) NOT VALID;
