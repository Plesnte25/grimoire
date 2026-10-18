-- AlterTable
ALTER TABLE "Work" ADD COLUMN "airedEpisodeCount" INTEGER;
ALTER TABLE "Work" ADD COLUMN "totalEpisodes" INTEGER;
ALTER TABLE "Work" ADD COLUMN "totalSeasons" INTEGER;


UPDATE "Work" SET
    "totalEpisodes" = (SELECT m."episodes" FROM "MediaItem" m WHERE m."id" = "Work"."id"),
    "airedEpisodeCount" = (SELECT m."airedEpisodeCount" FROM "MediaItem" m WHERE m."id" = "Work"."id"),
    "totalSeasons" = (SELECT m."seasons" FROM "MediaItem" m WHERE m."id" = "Work"."id");
