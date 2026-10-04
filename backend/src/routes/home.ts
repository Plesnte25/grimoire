import { Router } from "express";
import { prisma } from "../db.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const homeRouter = Router();

const WATCHED_STATUSES = ["IN_PROGRESS"] as const;
const ALL_TYPES = ["MOVIE", "TV", "ANIME", "BOOK"] as const;

homeRouter.get(
    "/",
    asyncHandler(async (_req, res) => {
        const now = Date.now();
        const recentReleaseThresholdMs = 45 * 24 * 60 * 60 * 1000;
        const [inProgress, watched, recentlyAdded] = await Promise.all([
            prisma.mediaItem.findMany({
                where: { status: "IN_PROGRESS", mediaType: { in: [...ALL_TYPES] } },
                orderBy: [{ updatedAt: "desc" }],
                take: 12,
            }),
            prisma.mediaItem.findMany({
                where: {
                    status: { in: [...WATCHED_STATUSES] },
                    mediaType: { in: [...ALL_TYPES] },
                },
                orderBy: [{ updatedAt: "desc" }],
                take: 200,
            }),
            prisma.mediaItem.findMany({
                where: { mediaType: { in: [...ALL_TYPES] } },
                orderBy: [{ createdAt: "desc" }],
                take: 12,
            }),
        ]);

        const withNewEpisodeCount = (item: (typeof watched)[number]) => {
            const watchedCount = item.progressValue ?? 0;
            const airedCount = item.airedEpisodeCount ?? item.episodes ?? 0;
            return {
                ...item,
                newEpisodeCount: Math.max(0, airedCount - watchedCount),
            };
        };

        const newEpisodes = watched
            .filter((item) => {
                const watchedCount = item.progressValue ?? 0;
                const hasNewAiredEpisodes =
                    (item.mediaType === "TV" || item.mediaType === "ANIME") &&
                    item.airedEpisodeCount != null &&
                    item.airedEpisodeCount > watchedCount;
                const recentlyReleased =
                    [item.releaseDate, item.digitalReleaseDate, item.lastAiredDate]
                        .filter((d): d is Date => d instanceof Date)
                        .some((d) => d.getTime() <= now && now - d.getTime() <= recentReleaseThresholdMs);
                const isActivelyAiring = item.airStatus === "AIRING" || item.airStatus === "RETURNING";
                return hasNewAiredEpisodes || recentlyReleased || isActivelyAiring;
            })
            .slice(0, 12)
            .map(withNewEpisodeCount);

        res.json({
            continueWatching: inProgress.map(withNewEpisodeCount),
            newEpisodes,
            recentlyAdded: recentlyAdded.map(withNewEpisodeCount),
        });
    })
);
