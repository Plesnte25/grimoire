-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_LibraryEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL DEFAULT 'singleton',
    "workId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "score" REAL,
    "ratedAt" DATETIME,
    "notes" TEXT,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "rewatchCount" INTEGER NOT NULL DEFAULT 0,
    "legacyProgressValue" INTEGER,
    "legacyProgressSeason" INTEGER,
    "legacyProgressEpisode" INTEGER,
    "legacyProgressTotal" INTEGER,
    "legacyProgressText" TEXT,
    "legacyCompletedSeasons" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LibraryEntry_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_LibraryEntry" ("createdAt", "finishedAt", "id", "notes", "rewatchCount", "score", "startedAt", "status", "updatedAt", "workId") SELECT "createdAt", "finishedAt", "id", "notes", "rewatchCount", "score", "startedAt", "status", "updatedAt", "workId" FROM "LibraryEntry";
DROP TABLE "LibraryEntry";
ALTER TABLE "new_LibraryEntry" RENAME TO "LibraryEntry";
CREATE INDEX "LibraryEntry_workId_idx" ON "LibraryEntry"("workId");
CREATE INDEX "LibraryEntry_status_idx" ON "LibraryEntry"("status");
CREATE UNIQUE INDEX "LibraryEntry_accountId_workId_key" ON "LibraryEntry"("accountId", "workId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;


-- Carry the pointer-style progress and rating time over from MediaItem.
UPDATE "LibraryEntry" SET
    "legacyProgressValue" = (SELECT m."progressValue" FROM "MediaItem" m WHERE m."id" = "LibraryEntry"."workId"),
    "legacyProgressSeason" = (SELECT m."progressSeason" FROM "MediaItem" m WHERE m."id" = "LibraryEntry"."workId"),
    "legacyProgressEpisode" = (SELECT m."progressEpisode" FROM "MediaItem" m WHERE m."id" = "LibraryEntry"."workId"),
    "legacyProgressTotal" = (SELECT m."progressTotalOverride" FROM "MediaItem" m WHERE m."id" = "LibraryEntry"."workId"),
    "legacyProgressText" = (SELECT m."progressText" FROM "MediaItem" m WHERE m."id" = "LibraryEntry"."workId"),
    "legacyCompletedSeasons" = (SELECT m."completedSeasonCount" FROM "MediaItem" m WHERE m."id" = "LibraryEntry"."workId"),
    "ratedAt" = (SELECT m."yourRatingAt" FROM "MediaItem" m WHERE m."id" = "LibraryEntry"."workId");
