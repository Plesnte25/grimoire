import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { parseOrThrow } from "../utils/validate.js";

export const statsRouter = Router();

statsRouter.get("/year", asyncHandler(async (req, res) => {
    const { year } = parseOrThrow(
        z.object({ year: z.coerce.number().int().min(1900).max(3000).optional() }),
        req.query
    );
    const selectedYear = year ?? new Date().getUTCFullYear();
    const start = new Date(Date.UTC(selectedYear, 0, 1));
    const end = new Date(Date.UTC(selectedYear + 1, 0, 1));
    const logs = await prisma.watchLog.findMany({
        where: { finishedAt: { gte: start, lt: end } },
        orderBy: { finishedAt: "asc" },
        select: {
            mediaId: true,
            finishedAt: true,
            rating: true,
            media: {
                select: {
                    mediaType: true,
                    countryOfOrigin: true,
                    globalRating: true,
                },
            },
        },
    });

    const completed = new Map<string, (typeof logs)[number]["media"]>();
    const months = Array.from({ length: 12 }, () => 0);
    const ratingDistribution = new Map<number, number>();
    const countryCounts = new Map<string, Set<string>>();
    const types = new Map<string, Set<string>>();
    let userRatingTotal = 0;
    let userRatingCount = 0;
    let providerRatingTotal = 0;
    let providerRatingCount = 0;

    for (const log of logs) {
        completed.set(log.mediaId, log.media);
        if (log.finishedAt) months[log.finishedAt.getUTCMonth()]++;
        if (log.rating != null) {
            const rounded = Math.max(1, Math.min(10, Math.round(log.rating)));
            ratingDistribution.set(rounded, (ratingDistribution.get(rounded) ?? 0) + 1);
            userRatingTotal += log.rating;
            userRatingCount++;
        }
        if (log.media.globalRating != null) {
            providerRatingTotal += log.media.globalRating;
            providerRatingCount++;
        }
    }
    for (const [mediaId, media] of completed) {
        const typeIds = types.get(media.mediaType) ?? new Set<string>();
        typeIds.add(mediaId);
        types.set(media.mediaType, typeIds);
        const country = media.countryOfOrigin ?? "Unknown";
        const countryIds = countryCounts.get(country) ?? new Set<string>();
        countryIds.add(mediaId);
        countryCounts.set(country, countryIds);
    }

    res.json({
        year: selectedYear,
        finishedLogCount: logs.length,
        completedTitleCount: completed.size,
        monthly: months,
        ratingDistribution: [...ratingDistribution.entries()]
            .sort(([a], [b]) => a - b)
            .map(([rating, count]) => ({ rating, count })),
        averagePersonalRating: userRatingCount ? userRatingTotal / userRatingCount : null,
        averageProviderRating: providerRatingCount ? providerRatingTotal / providerRatingCount : null,
        countries: [...countryCounts.entries()]
            .map(([country, ids]) => ({ country, count: ids.size }))
            .sort((a, b) => b.count - a.count),
        mediaTypes: [...types.entries()].map(([mediaType, ids]) => ({ mediaType, count: ids.size })),
    });
}));
