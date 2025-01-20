-- Create a new table with the desired column order
CREATE TABLE "kirbo407"."user_new" (
    "id" TEXT NOT NULL,
    "account_id" INTEGER NOT NULL DEFAULT nextval('"kirbo407"."user_account_id_seq"'),
    "name" TEXT,
    "username" TEXT,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "password" TEXT,
    "bio" TEXT,
    "location" TEXT,
    "website" TEXT,
    "businessName" TEXT,
    "taxId" TEXT,
    CONSTRAINT "user_new_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "user_new_account_id_key" UNIQUE ("account_id"),
    CONSTRAINT "user_new_email_key" UNIQUE ("email"),
    CONSTRAINT "user_new_username_key" UNIQUE ("username")
);

-- Copy data from old table to new table
INSERT INTO "kirbo407"."user_new" 
SELECT 
    id,
    account_id,
    name,
    username,
    email,
    "createdAt",
    "updatedAt",
    "emailVerified",
    image,
    password,
    bio,
    location,
    website,
    "businessName",
    "taxId"
FROM "kirbo407"."user";

-- Drop foreign key constraints
ALTER TABLE "kirbo407"."account" DROP CONSTRAINT IF EXISTS "account_userId_fkey";
ALTER TABLE "kirbo407"."session" DROP CONSTRAINT IF EXISTS "session_userId_fkey";
ALTER TABLE "kirbo407"."product" DROP CONSTRAINT IF EXISTS "product_userId_fkey";
ALTER TABLE "kirbo407"."listing" DROP CONSTRAINT IF EXISTS "listing_userId_fkey";
ALTER TABLE "kirbo407"."platformconnection" DROP CONSTRAINT IF EXISTS "platformconnection_userId_fkey";
ALTER TABLE "kirbo407"."subscriptionstatus" DROP CONSTRAINT IF EXISTS "subscriptionstatus_userId_fkey";

-- Drop the old table
DROP TABLE "kirbo407"."user";

-- Rename the new table to the original name
ALTER TABLE "kirbo407"."user_new" RENAME TO "user";

-- Recreate indexes
CREATE INDEX "user_email_idx" ON "kirbo407"."user"("email");
CREATE INDEX "user_username_idx" ON "kirbo407"."user"("username");

-- Recreate foreign key constraints
ALTER TABLE "kirbo407"."account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "kirbo407"."user"("id") ON DELETE CASCADE;
ALTER TABLE "kirbo407"."session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "kirbo407"."user"("id") ON DELETE CASCADE;
ALTER TABLE "kirbo407"."product" ADD CONSTRAINT "product_userId_fkey" FOREIGN KEY ("userId") REFERENCES "kirbo407"."user"("id") ON DELETE CASCADE;
ALTER TABLE "kirbo407"."listing" ADD CONSTRAINT "listing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "kirbo407"."user"("id") ON DELETE CASCADE;
ALTER TABLE "kirbo407"."platformconnection" ADD CONSTRAINT "platformconnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "kirbo407"."user"("id") ON DELETE CASCADE;
ALTER TABLE "kirbo407"."subscriptionstatus" ADD CONSTRAINT "subscriptionstatus_userId_fkey" FOREIGN KEY ("userId") REFERENCES "kirbo407"."user"("id") ON DELETE CASCADE; 