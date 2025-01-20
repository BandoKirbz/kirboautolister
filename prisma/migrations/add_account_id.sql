-- Create sequence starting from 1000
CREATE SEQUENCE IF NOT EXISTS "kirbo407"."user_account_id_seq" START WITH 1000;

-- Add account_id column with NOT NULL constraint and default value
ALTER TABLE "kirbo407"."user" ADD COLUMN "account_id" INTEGER NOT NULL DEFAULT nextval('"kirbo407"."user_account_id_seq"') UNIQUE;

-- Set account_id for existing user
UPDATE "kirbo407"."user" SET "account_id" = nextval('"kirbo407"."user_account_id_seq"') WHERE "email" = 'vlhasnerm@yahoo.com'; 