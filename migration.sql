yarn run v1.22.22
$ /Users/teamshift/Documents/kirbo-autolister/node_modules/.bin/prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "kirbo407";

-- CreateEnum
CREATE TYPE "kirbo407"."ListingStatus" AS ENUM ('DRAFT', 'PENDING', 'ACTIVE', 'PAUSED', 'ENDED', 'ERROR');

-- CreateEnum
CREATE TYPE "kirbo407"."BillingInterval" AS ENUM ('MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "kirbo407"."SubStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'PAST_DUE', 'CANCELLED', 'TRIALING');

-- CreateTable
CREATE TABLE "kirbo407"."user" (
    "id" TEXT NOT NULL,
    "account_id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "name" TEXT,
    "image" TEXT,
    "password" TEXT,
    "username" TEXT,
    "bio" TEXT,
    "location" TEXT,
    "website" TEXT,
    "businessName" TEXT,
    "taxId" TEXT,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kirbo407"."account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kirbo407"."session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kirbo407"."product" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "sku" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "brand" TEXT,
    "category" TEXT,
    "condition" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "location" TEXT,

    CONSTRAINT "product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kirbo407"."productimage" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "productimage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kirbo407"."listing" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "platformId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "condition" TEXT NOT NULL,
    "platformListingId" TEXT,
    "status" "kirbo407"."ListingStatus" NOT NULL DEFAULT 'DRAFT',
    "errors" TEXT,

    CONSTRAINT "listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kirbo407"."platform" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "website" TEXT NOT NULL,
    "logoUrl" TEXT,

    CONSTRAINT "platform_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kirbo407"."platformconnection" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "platformId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "credentials" JSONB,
    "settings" JSONB,

    CONSTRAINT "platformconnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kirbo407"."subscriptionplan" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "interval" "kirbo407"."BillingInterval" NOT NULL,
    "features" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "subscriptionplan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kirbo407"."subscriptionstatus" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "kirbo407"."SubStatus" NOT NULL DEFAULT 'INACTIVE',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,

    CONSTRAINT "subscriptionstatus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_account_id_key" ON "kirbo407"."user"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "kirbo407"."user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_username_key" ON "kirbo407"."user"("username");

-- CreateIndex
CREATE INDEX "user_email_idx" ON "kirbo407"."user"("email");

-- CreateIndex
CREATE INDEX "user_username_idx" ON "kirbo407"."user"("username");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "kirbo407"."account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "account_provider_providerAccountId_key" ON "kirbo407"."account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "session_sessionToken_key" ON "kirbo407"."session"("sessionToken");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "kirbo407"."session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "product_sku_key" ON "kirbo407"."product"("sku");

-- CreateIndex
CREATE INDEX "product_userId_idx" ON "kirbo407"."product"("userId");

-- CreateIndex
CREATE INDEX "product_sku_idx" ON "kirbo407"."product"("sku");

-- CreateIndex
CREATE INDEX "product_name_description_idx" ON "kirbo407"."product"("name", "description");

-- CreateIndex
CREATE INDEX "productimage_productId_idx" ON "kirbo407"."productimage"("productId");

-- CreateIndex
CREATE INDEX "listing_userId_idx" ON "kirbo407"."listing"("userId");

-- CreateIndex
CREATE INDEX "listing_productId_idx" ON "kirbo407"."listing"("productId");

-- CreateIndex
CREATE INDEX "listing_platformId_idx" ON "kirbo407"."listing"("platformId");

-- CreateIndex
CREATE INDEX "listing_status_idx" ON "kirbo407"."listing"("status");

-- CreateIndex
CREATE UNIQUE INDEX "platform_name_key" ON "kirbo407"."platform"("name");

-- CreateIndex
CREATE UNIQUE INDEX "platform_slug_key" ON "kirbo407"."platform"("slug");

-- CreateIndex
CREATE INDEX "platformconnection_userId_idx" ON "kirbo407"."platformconnection"("userId");

-- CreateIndex
CREATE INDEX "platformconnection_platformId_idx" ON "kirbo407"."platformconnection"("platformId");

-- CreateIndex
CREATE UNIQUE INDEX "platformconnection_userId_platformId_key" ON "kirbo407"."platformconnection"("userId", "platformId");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptionplan_name_key" ON "kirbo407"."subscriptionplan"("name");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptionstatus_userId_key" ON "kirbo407"."subscriptionstatus"("userId");

-- CreateIndex
CREATE INDEX "subscriptionstatus_userId_idx" ON "kirbo407"."subscriptionstatus"("userId");

-- CreateIndex
CREATE INDEX "subscriptionstatus_planId_idx" ON "kirbo407"."subscriptionstatus"("planId");

-- CreateIndex
CREATE INDEX "subscriptionstatus_status_idx" ON "kirbo407"."subscriptionstatus"("status");

-- AddForeignKey
ALTER TABLE "kirbo407"."account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "kirbo407"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kirbo407"."session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "kirbo407"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kirbo407"."product" ADD CONSTRAINT "product_userId_fkey" FOREIGN KEY ("userId") REFERENCES "kirbo407"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kirbo407"."productimage" ADD CONSTRAINT "productimage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "kirbo407"."product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kirbo407"."listing" ADD CONSTRAINT "listing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "kirbo407"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kirbo407"."listing" ADD CONSTRAINT "listing_productId_fkey" FOREIGN KEY ("productId") REFERENCES "kirbo407"."product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kirbo407"."listing" ADD CONSTRAINT "listing_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "kirbo407"."platform"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kirbo407"."platformconnection" ADD CONSTRAINT "platformconnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "kirbo407"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kirbo407"."platformconnection" ADD CONSTRAINT "platformconnection_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "kirbo407"."platform"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kirbo407"."subscriptionstatus" ADD CONSTRAINT "subscriptionstatus_userId_fkey" FOREIGN KEY ("userId") REFERENCES "kirbo407"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kirbo407"."subscriptionstatus" ADD CONSTRAINT "subscriptionstatus_planId_fkey" FOREIGN KEY ("planId") REFERENCES "kirbo407"."subscriptionplan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

Done in 0.85s.
