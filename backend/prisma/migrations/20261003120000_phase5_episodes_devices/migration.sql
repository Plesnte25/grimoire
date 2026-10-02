CREATE TABLE "Episode" (
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
    CONSTRAINT "Episode_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Episode_mediaId_seasonNumber_episodeNumber_key" ON "Episode"("mediaId", "seasonNumber", "episodeNumber");
CREATE INDEX "Episode_mediaId_seasonNumber_episodeNumber_idx" ON "Episode"("mediaId", "seasonNumber", "episodeNumber");

CREATE TABLE "EpisodeSeasonCache" (
    "mediaId" TEXT NOT NULL,
    "seasonNumber" INTEGER NOT NULL,
    "checkedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("mediaId", "seasonNumber"),
    CONSTRAINT "EpisodeSeasonCache_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

ALTER TABLE "TrustedDevice" ADD COLUMN "userAgent" TEXT;
