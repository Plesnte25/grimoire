-- CreateTable
CREATE TABLE "Franchise" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "nativeTitle" TEXT,
    "posterUrl" TEXT,
    "bannerUrl" TEXT,
    "countryOfOrigin" TEXT,
    "status" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WatchLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mediaId" TEXT NOT NULL,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "rating" REAL,
    "review" TEXT,
    "reviewHasSpoilers" BOOLEAN NOT NULL DEFAULT false,
    "isRewatch" BOOLEAN NOT NULL DEFAULT false,
    "watchedOn" TEXT,
    "watchMode" TEXT,
    "watchedWith" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WatchLog_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Contributor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "imageUrl" TEXT
);

-- CreateTable
CREATE TABLE "Credit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mediaId" TEXT NOT NULL,
    "contributorId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "character" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Credit_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Credit_contributorId_fkey" FOREIGN KEY ("contributorId") REFERENCES "Contributor" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'TAG',
    "color" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "MediaTag" (
    "mediaId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    PRIMARY KEY ("mediaId", "tagId"),
    CONSTRAINT "MediaTag_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MediaTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MediaItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mediaType" TEXT NOT NULL,
    "format" TEXT,
    "isAdult" BOOLEAN,
    "episodes" INTEGER,
    "duration" INTEGER,
    "provider" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "nativeTitle" TEXT,
    "year" INTEGER,
    "description" TEXT,
    "posterUrl" TEXT,
    "backdropUrl" TEXT,
    "globalRating" REAL,
    "globalRatingText" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "yourRating" REAL,
    "yourNotes" TEXT,
    "progressText" TEXT,
    "progressValue" INTEGER,
    "progressSeason" INTEGER,
    "progressEpisode" INTEGER,
    "progressTotalOverride" INTEGER,
    "completedSeasonCount" INTEGER,
    "genres" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "collectionId" TEXT,
    "collectionName" TEXT,
    "collectionSource" TEXT,
    "franchiseId" TEXT,
    "franchiseRole" TEXT,
    "franchiseOrder" INTEGER,
    "countryOfOrigin" TEXT,
    "originalLanguage" TEXT,
    "region" TEXT,
    "regionOverride" TEXT,
    "creator" TEXT,
    "seasons" INTEGER,
    "pageCount" INTEGER,
    "isbn" TEXT,
    "releaseDate" DATETIME,
    "airStatus" TEXT,
    "lastAiredSeason" INTEGER,
    "lastAiredEpisode" INTEGER,
    "lastAiredDate" DATETIME,
    "nextAirSeason" INTEGER,
    "nextAirEpisode" INTEGER,
    "nextAirDate" DATETIME,
    "airedEpisodeCount" INTEGER,
    "announcedNext" TEXT,
    "announcedNextDate" DATETIME,
    "digitalReleaseDate" DATETIME,
    "metaCheckedAt" DATETIME,
    "airCheckedAt" DATETIME,
    CONSTRAINT "MediaItem_franchiseId_fkey" FOREIGN KEY ("franchiseId") REFERENCES "Franchise" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_MediaItem" ("backdropUrl", "collectionId", "collectionName", "collectionSource", "createdAt", "description", "duration", "episodes", "format", "genres", "globalRating", "globalRatingText", "id", "isAdult", "mediaType", "nativeTitle", "posterUrl", "progressText", "progressValue", "provider", "providerId", "status", "title", "updatedAt", "year", "yourNotes", "yourRating") SELECT "backdropUrl", "collectionId", "collectionName", "collectionSource", "createdAt", "description", "duration", "episodes", "format", "genres", "globalRating", "globalRatingText", "id", "isAdult", "mediaType", "nativeTitle", "posterUrl", "progressText", "progressValue", "provider", "providerId", "status", "title", "updatedAt", "year", "yourNotes", "yourRating" FROM "MediaItem";
DROP TABLE "MediaItem";
ALTER TABLE "new_MediaItem" RENAME TO "MediaItem";
CREATE INDEX "MediaItem_collectionId_idx" ON "MediaItem"("collectionId");
CREATE INDEX "MediaItem_franchiseId_idx" ON "MediaItem"("franchiseId");
CREATE INDEX "MediaItem_mediaType_region_idx" ON "MediaItem"("mediaType", "region");
CREATE UNIQUE INDEX "MediaItem_provider_providerId_key" ON "MediaItem"("provider", "providerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "WatchLog_mediaId_idx" ON "WatchLog"("mediaId");

-- CreateIndex
CREATE INDEX "WatchLog_finishedAt_idx" ON "WatchLog"("finishedAt");

-- CreateIndex
CREATE INDEX "Credit_contributorId_idx" ON "Credit"("contributorId");

-- CreateIndex
CREATE UNIQUE INDEX "Credit_mediaId_contributorId_role_key" ON "Credit"("mediaId", "contributorId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- CreateIndex
CREATE INDEX "MediaTag_tagId_idx" ON "MediaTag"("tagId");
