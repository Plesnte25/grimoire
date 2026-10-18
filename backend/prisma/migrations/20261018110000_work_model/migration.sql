-- CreateTable
CREATE TABLE "Work" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "originalTitle" TEXT,
    "year" INTEGER,
    "country" TEXT,
    "language" TEXT,
    "overview" TEXT,
    "posterUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ExternalId" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "confidence" REAL NOT NULL DEFAULT 1.0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "ExternalId_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Season" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    CONSTRAINT "Season_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LibraryEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "score" REAL,
    "notes" TEXT,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "rewatchCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LibraryEntry_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EpisodeProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "libraryEntryId" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "watchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EpisodeProgress_libraryEntryId_fkey" FOREIGN KEY ("libraryEntryId") REFERENCES "LibraryEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EpisodeProgress_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WatchEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "libraryEntryId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WatchEvent_libraryEntryId_fkey" FOREIGN KEY ("libraryEntryId") REFERENCES "LibraryEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FranchiseLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workId" TEXT NOT NULL,
    "franchiseId" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "order" INTEGER,
    CONSTRAINT "FranchiseLink_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FranchiseLink_franchiseId_fkey" FOREIGN KEY ("franchiseId") REFERENCES "Franchise" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Credit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mediaId" TEXT NOT NULL,
    "contributorId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "character" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "workId" TEXT,
    CONSTRAINT "Credit_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Credit_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Credit_contributorId_fkey" FOREIGN KEY ("contributorId") REFERENCES "Contributor" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Credit" ("character", "contributorId", "id", "mediaId", "order", "role") SELECT "character", "contributorId", "id", "mediaId", "order", "role" FROM "Credit";
DROP TABLE "Credit";
ALTER TABLE "new_Credit" RENAME TO "Credit";
CREATE INDEX "Credit_contributorId_idx" ON "Credit"("contributorId");
CREATE INDEX "Credit_workId_idx" ON "Credit"("workId");
CREATE UNIQUE INDEX "Credit_mediaId_contributorId_role_key" ON "Credit"("mediaId", "contributorId", "role");
CREATE TABLE "new_Episode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mediaId" TEXT NOT NULL,
    "seasonNumber" INTEGER NOT NULL,
    "episodeNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "overview" TEXT,
    "airDate" DATETIME,
    "runtime" INTEGER,
    "stillUrl" TEXT,
    "updatedAt" DATETIME NOT NULL,
    "workId" TEXT,
    "seasonId" TEXT,
    CONSTRAINT "Episode_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Episode_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Episode_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Episode" ("airDate", "episodeNumber", "id", "mediaId", "name", "overview", "runtime", "seasonNumber", "stillUrl", "updatedAt") SELECT "airDate", "episodeNumber", "id", "mediaId", "name", "overview", "runtime", "seasonNumber", "stillUrl", "updatedAt" FROM "Episode";
DROP TABLE "Episode";
ALTER TABLE "new_Episode" RENAME TO "Episode";
CREATE INDEX "Episode_mediaId_seasonNumber_episodeNumber_idx" ON "Episode"("mediaId", "seasonNumber", "episodeNumber");
CREATE INDEX "Episode_workId_idx" ON "Episode"("workId");
CREATE UNIQUE INDEX "Episode_mediaId_seasonNumber_episodeNumber_key" ON "Episode"("mediaId", "seasonNumber", "episodeNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Work_type_idx" ON "Work"("type");

-- CreateIndex
CREATE INDEX "ExternalId_workId_idx" ON "ExternalId"("workId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalId_source_externalId_key" ON "ExternalId"("source", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Season_workId_number_key" ON "Season"("workId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryEntry_workId_key" ON "LibraryEntry"("workId");

-- CreateIndex
CREATE INDEX "LibraryEntry_status_idx" ON "LibraryEntry"("status");

-- CreateIndex
CREATE UNIQUE INDEX "EpisodeProgress_libraryEntryId_episodeId_key" ON "EpisodeProgress"("libraryEntryId", "episodeId");

-- CreateIndex
CREATE INDEX "WatchEvent_libraryEntryId_occurredAt_idx" ON "WatchEvent"("libraryEntryId", "occurredAt");

-- CreateIndex
CREATE INDEX "FranchiseLink_franchiseId_order_idx" ON "FranchiseLink"("franchiseId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "FranchiseLink_workId_franchiseId_key" ON "FranchiseLink"("workId", "franchiseId");
