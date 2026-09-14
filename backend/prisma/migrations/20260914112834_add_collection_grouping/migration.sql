-- AlterTable
ALTER TABLE "MediaItem" ADD COLUMN "collectionId" TEXT;
ALTER TABLE "MediaItem" ADD COLUMN "collectionName" TEXT;
ALTER TABLE "MediaItem" ADD COLUMN "collectionSource" TEXT;

-- CreateIndex
CREATE INDEX "MediaItem_collectionId_idx" ON "MediaItem"("collectionId");
