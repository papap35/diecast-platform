-- CreateEnum
CREATE TYPE "MemberTier" AS ENUM ('ROOKIE', 'DRIVER', 'CHAMPION', 'LEGEND');

-- CreateEnum
CREATE TYPE "GarageCondition" AS ENUM ('SEALED', 'OPENED', 'DISPLAYED', 'PLAYWORN');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ORDER_PAID', 'ORDER_SHIPPED', 'ORDER_ARRIVED', 'ORDER_CANCELLED', 'ORDER_REFUNDED', 'RELEASE_REMINDER', 'WISHLIST_RESTOCK', 'TIER_UPGRADED');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('EXHIBITION', 'MEETUP', 'LAUNCH', 'ONLINE');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "garageHandle" TEXT,
ADD COLUMN     "garagePublic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tier" "MemberTier" NOT NULL DEFAULT 'ROOKIE',
ADD COLUMN     "tierUpdatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "earlyAccessAt" TIMESTAMP(3),
ADD COLUMN     "earlyAccessTier" "MemberTier",
ADD COLUMN     "restockedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "WishlistItem" (
    "memberId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WishlistItem_pkey" PRIMARY KEY ("memberId","productId")
);

-- CreateTable
CREATE TABLE "ReleaseReminder" (
    "memberId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReleaseReminder_pkey" PRIMARY KEY ("memberId","productId")
);

-- CreateTable
CREATE TABLE "GarageItem" (
    "id" UUID NOT NULL,
    "memberId" UUID NOT NULL,
    "productId" UUID,
    "orderItemId" UUID,
    "name" TEXT NOT NULL,
    "brandName" TEXT,
    "scale" TEXT,
    "condition" "GarageCondition" NOT NULL DEFAULT 'SEALED',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "pricePaid" INTEGER,
    "acquiredAt" TIMESTAMP(3),
    "note" TEXT,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GarageItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "memberId" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailMessage" (
    "id" UUID NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "notificationId" UUID,
    "status" "EmailStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "EventType" NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "venue" TEXT,
    "address" TEXT,
    "url" TEXT,
    "coverImageUrl" TEXT,
    "productId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventTranslation" (
    "eventId" UUID NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "body" TEXT NOT NULL,

    CONSTRAINT "EventTranslation_pkey" PRIMARY KEY ("eventId","locale")
);

-- CreateIndex
CREATE INDEX "WishlistItem_productId_idx" ON "WishlistItem"("productId");

-- CreateIndex
CREATE INDEX "ReleaseReminder_notifiedAt_idx" ON "ReleaseReminder"("notifiedAt");

-- CreateIndex
CREATE UNIQUE INDEX "GarageItem_orderItemId_key" ON "GarageItem"("orderItemId");

-- CreateIndex
CREATE INDEX "GarageItem_memberId_createdAt_idx" ON "GarageItem"("memberId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_memberId_createdAt_idx" ON "Notification"("memberId", "createdAt");

-- CreateIndex
CREATE INDEX "EmailMessage_status_createdAt_idx" ON "EmailMessage"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Event_slug_key" ON "Event"("slug");

-- CreateIndex
CREATE INDEX "Event_status_startsAt_idx" ON "Event"("status", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "Member_garageHandle_key" ON "Member"("garageHandle");

-- CreateIndex
CREATE INDEX "Member_tier_idx" ON "Member"("tier");

-- AddForeignKey
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReleaseReminder" ADD CONSTRAINT "ReleaseReminder_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReleaseReminder" ADD CONSTRAINT "ReleaseReminder_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GarageItem" ADD CONSTRAINT "GarageItem_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GarageItem" ADD CONSTRAINT "GarageItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GarageItem" ADD CONSTRAINT "GarageItem_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventTranslation" ADD CONSTRAINT "EventTranslation_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 資料完整性：數量與金額不可為負
ALTER TABLE "GarageItem" ADD CONSTRAINT "GarageItem_quantity_check" CHECK ("quantity" > 0);
ALTER TABLE "GarageItem" ADD CONSTRAINT "GarageItem_pricePaid_check" CHECK ("pricePaid" IS NULL OR "pricePaid" >= 0);

-- 既有會員依累計消費換算等級（門檻與 src/modules/members/tiers.ts 相同）
UPDATE "Member"
SET "tier" = (CASE
      WHEN "totalSpent" >= 20000 THEN 'LEGEND'
      WHEN "totalSpent" >= 8000 THEN 'CHAMPION'
      ELSE 'DRIVER'
    END)::"MemberTier",
    "tierUpdatedAt" = CURRENT_TIMESTAMP
WHERE "totalSpent" >= 3000;
