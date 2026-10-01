-- AlterTable
ALTER TABLE "ListItem" ADD COLUMN "note" TEXT;

-- CreateTable
CREATE TABLE "TierList" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TierEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tierListId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "TierEntry_tierListId_fkey" FOREIGN KEY ("tierListId") REFERENCES "TierList" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TierEntry_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CustomList" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "coverColor" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'LIST',
    "mediaType" TEXT,
    "isRanked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_CustomList" ("coverColor", "createdAt", "description", "id", "name", "updatedAt") SELECT "coverColor", "createdAt", "description", "id", "name", "updatedAt" FROM "CustomList";
DROP TABLE "CustomList";
ALTER TABLE "new_CustomList" RENAME TO "CustomList";
CREATE INDEX "CustomList_kind_mediaType_idx" ON "CustomList"("kind", "mediaType");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "TierEntry_tierListId_mediaId_key" ON "TierEntry"("tierListId", "mediaId");
