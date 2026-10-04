import { Router } from "express";
import { prisma } from "../db.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const statsRouter = Router();

const MEDIA_TYPES = ["MOVIE", "TV", "ANIME", "BOOK"] as const;
const STATUSES = ["PLANNED", "IN_PROGRESS", "COMPLETED", "ON_HOLD", "DROPPED"] as const;

function parseGenres(raw: unknown): string[] {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.map(String).map((x) => x.trim()).filter(Boolean);
    if (typeof raw !== "string") return [];
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.map(String).map((x) => x.trim()).filter(Boolean);
    } catch { }
    return trimmed.split(",").map((x) => x.trim()).filter(Boolean);
}

function decadeFromYear(year?: number | null): string | null {
    if (!year || year < 1000) return null;
    const decade = Math.floor(year / 10) * 10;
    return `${decade}s`;
}

async function buildStats() {
    const [items, topCredits] = await Promise.all([
        prisma.mediaItem.findMany({
            select: {
                id: true,
                mediaType: true,
                status: true,
                episodes: true,
                airedEpisodeCount: true,
                progressValue: true,
                pageCount: true,
                yourRating: true,
                globalRating: true,
                genres: true,
                countryOfOrigin: true,
                year: true,
                title: true,
                posterUrl: true,
            },
        }),
        prisma.credit.groupBy({
            by: ["contributorId", "role"],
            _count: { _all: true },
            orderBy: { _count: { contributorId: "desc" } },
            take: 100,
        }),
    ]);

    const contributorIds = [...new Set(topCredits.map((entry) => entry.contributorId))];
    const contributors = contributorIds.length
        ? await prisma.contributor.findMany({
            where: { id: { in: contributorIds } },
            select: { id: true, name: true, kind: true },
        })
        : [];
    const contributorById = new Map(contributors.map((person) => [person.id, person]));

    const byMediaType = MEDIA_TYPES.map((mediaType) => ({
        mediaType,
        count: items.filter((item) => item.mediaType === mediaType).length,
    }));
    const byStatus = STATUSES.map((status) => ({
        status,
        count: items.filter((item) => item.status === status).length,
    }));

    const totalEpisodesTracked = items.reduce((sum, item) => {
        if (item.mediaType !== "TV" && item.mediaType !== "ANIME") return sum;
        return sum + (item.progressValue ?? 0);
    }, 0);
    const totalEpisodesAvailable = items.reduce((sum, item) => {
        if (item.mediaType !== "TV" && item.mediaType !== "ANIME") return sum;
        return sum + (item.episodes ?? item.airedEpisodeCount ?? 0);
    }, 0);
    const totalPagesTracked = items.reduce((sum, item) => {
        if (item.mediaType !== "BOOK") return sum;
        return sum + (item.progressValue ?? 0);
    }, 0);
    const totalPagesAvailable = items.reduce((sum, item) => {
        if (item.mediaType !== "BOOK") return sum;
        return sum + (item.pageCount ?? 0);
    }, 0);

    const ratingBuckets = new Map<number, number>();
    let userRatingTotal = 0;
    let userRatingCount = 0;
    let providerRatingTotal = 0;
    let providerRatingCount = 0;
    for (const item of items) {
        if (item.yourRating != null) {
            const rounded = Math.round(item.yourRating * 2) / 2;
            ratingBuckets.set(rounded, (ratingBuckets.get(rounded) ?? 0) + 1);
            userRatingTotal += item.yourRating;
            userRatingCount++;
        }
        if (item.globalRating != null) {
            providerRatingTotal += item.globalRating;
            providerRatingCount++;
        }
    }

    const highestRatedByType = MEDIA_TYPES.map((mediaType) => {
        const best = items
            .filter((item) => item.mediaType === mediaType && item.yourRating != null)
            .sort((a, b) => {
                const ratingDiff = (b.yourRating ?? -1) - (a.yourRating ?? -1);
                if (ratingDiff !== 0) return ratingDiff;
                return (b.globalRating ?? -1) - (a.globalRating ?? -1);
            })[0];
        return {
            mediaType,
            item: best
                ? {
                    id: best.id,
                    title: best.title,
                    posterUrl: best.posterUrl,
                    yourRating: best.yourRating,
                    globalRating: best.globalRating,
                }
                : null,
        };
    });

    const genreCounts = new Map<string, number>();
    const countryCounts = new Map<string, number>();
    const decadeCounts = new Map<string, number>();
    for (const item of items) {
        for (const genre of parseGenres(item.genres)) {
            genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
        }
        const country = item.countryOfOrigin ?? "Unknown";
        countryCounts.set(country, (countryCounts.get(country) ?? 0) + 1);
        const decade = decadeFromYear(item.year);
        if (decade) decadeCounts.set(decade, (decadeCounts.get(decade) ?? 0) + 1);
    }

    const roleBuckets = new Set(["DIRECTOR", "AUTHOR", "CREATOR", "STUDIO"]);
    const topContributors = topCredits
        .filter((entry) => roleBuckets.has(entry.role))
        .map((entry) => {
            const contributor = contributorById.get(entry.contributorId);
            return {
                role: entry.role,
                contributorId: entry.contributorId,
                name: contributor?.name ?? entry.contributorId,
                kind: contributor?.kind ?? "PERSON",
                count: entry._count._all,
            };
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);

    return {
        libraryTotals: {
            totalTitles: items.length,
            byMediaType,
            byStatus,
            totalEpisodesTracked,
            totalEpisodesAvailable,
            totalPagesTracked,
            totalPagesAvailable,
        },
        ratings: {
            distribution: [...ratingBuckets.entries()]
                .sort(([a], [b]) => a - b)
                .map(([rating, count]) => ({ rating, count })),
            averagePersonalRating: userRatingCount ? userRatingTotal / userRatingCount : null,
            averageProviderRating: providerRatingCount ? providerRatingTotal / providerRatingCount : null,
            highestRatedByType,
        },
        tasteProfile: {
            topGenres: [...genreCounts.entries()]
                .sort((a, b) => b[1] - a[1])
                .slice(0, 20)
                .map(([genre, count]) => ({ genre, count })),
            countries: [...countryCounts.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([country, count]) => ({ country, count })),
            releaseDecades: [...decadeCounts.entries()]
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([decade, count]) => ({ decade, count })),
            topContributors,
        },
    };
}

statsRouter.get("/", asyncHandler(async (_req, res) => {
    res.json(await buildStats());
}));

statsRouter.get("/year", asyncHandler(async (_req, res) => {
    res.json(await buildStats());
}));
