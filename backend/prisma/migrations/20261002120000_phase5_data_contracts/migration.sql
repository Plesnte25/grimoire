ALTER TABLE "MediaItem" ADD COLUMN "yourRatingAt" DATETIME;
ALTER TABLE "MediaItem" ADD COLUMN "tmdbId" TEXT;
ALTER TABLE "MediaItem" ADD COLUMN "tmdbMediaType" TEXT;
ALTER TABLE "MediaItem" ADD COLUMN "anilistPopularity" INTEGER;

CREATE INDEX "MediaItem_tmdbId_tmdbMediaType_idx" ON "MediaItem"("tmdbId", "tmdbMediaType");

ALTER TABLE "WatchLog" ADD COLUMN "fromEpisode" INTEGER;
ALTER TABLE "WatchLog" ADD COLUMN "toEpisode" INTEGER;
ALTER TABLE "WatchLog" ADD COLUMN "label" TEXT;

ALTER TABLE "AccountConfig" ADD COLUMN "showAdultContent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AccountConfig" ADD COLUMN "spoilerShield" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AccountConfig" ADD COLUMN "watchCountry" TEXT;
