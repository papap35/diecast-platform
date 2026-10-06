-- CreateEnum
CREATE TYPE "BannerPlacement" AS ENUM ('ANNOUNCEMENT', 'HOME_PROMO');

-- CreateEnum
CREATE TYPE "BannerTheme" AS ENUM ('INK', 'RED', 'NAVY', 'GOLD');

-- CreateTable
CREATE TABLE "Banner" (
    "id" UUID NOT NULL,
    "placement" "BannerPlacement" NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "theme" "BannerTheme" NOT NULL DEFAULT 'INK',
    "linkUrl" TEXT,
    "imageUrl" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Banner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BannerTranslation" (
    "bannerId" UUID NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "ctaLabel" TEXT,

    CONSTRAINT "BannerTranslation_pkey" PRIMARY KEY ("bannerId","locale")
);

-- CreateIndex
CREATE INDEX "Banner_placement_status_idx" ON "Banner"("placement", "status");

-- AddForeignKey
ALTER TABLE "BannerTranslation" ADD CONSTRAINT "BannerTranslation_bannerId_fkey" FOREIGN KEY ("bannerId") REFERENCES "Banner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
