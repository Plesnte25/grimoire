ALTER TABLE "MediaItem" ADD COLUMN "rewatchCount" INTEGER NOT NULL DEFAULT 0;

UPDATE "MediaItem"
SET "rewatchCount" = (
    SELECT CASE
        WHEN COUNT(*) > 0 THEN COUNT(*) - 1
        ELSE 0
    END
    FROM "WatchLog"
    WHERE "WatchLog"."mediaId" = "MediaItem"."id"
      AND "WatchLog"."finishedAt" IS NOT NULL
);

CREATE TABLE "SuggestionDismissal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "mediaType" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "SuggestionDismissal_provider_providerId_key"
ON "SuggestionDismissal"("provider", "providerId");

CREATE INDEX "SuggestionDismissal_mediaType_idx"
ON "SuggestionDismissal"("mediaType");

DROP TABLE "WatchLog";
DROP TABLE "Reminder";
DROP TABLE "AnnualGoal";
