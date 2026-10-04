import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { parseOrThrow } from "../utils/validate.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { tmdbDiscoverByGenres, tmdbRecommendations } from "../services/providers/tmdb.js";
import { anilistDiscoverByGenres, anilistRecommendations } from "../services/providers/anilist.js";
import { googleBooksSearch } from "../services/providers/googleBooks.js";

type AnimeScope = "SERIES" | "MOVIES" | "HENTAI";

const SUG_TTL_MS = 2 * 60 * 1000;
const SUG_CACHE = new Map<string, { at: number; payload: any }>();
const MEDIA_TYPES = ["MOVIE", "TV", "ANIME", "BOOK"] as const;
type MediaType = (typeof MEDIA_TYPES)[number];

export const suggestionsRouter = Router();

function cacheGet(key: string) {
    const value = SUG_CACHE.get(key);
    if (!value) return null;
    if (Date.now() - value.at > SUG_TTL_MS) {
        SUG_CACHE.delete(key);
        return null;
    }
    return value.payload;
}

function cacheSet(key: string, payload: any) {
    SUG_CACHE.set(key, { at: Date.now(), payload });
}

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

function pickTopGenres(items: { genres?: unknown; yourRating?: number | null }[], max = 6): string[] {
    const frequency = new Map<string, number>();
    for (const item of items) {
        for (const genre of parseGenres(item.genres)) {
            const weight = item.yourRating != null ? Math.max(0.25, item.yourRating / 10) : 1;
            frequency.set(genre, (frequency.get(genre) ?? 0) + weight);
        }
    }
    return [...frequency.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, max)
        .map(([name]) => name);
}

function daySeed() {
    const now = new Date();
    const dayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    return Math.floor(dayStart / (24 * 60 * 60 * 1000));
}

function uniqueByProvider(items: any[]) {
    const seen = new Set<string>();
    const out: any[] = [];
    for (const item of items) {
        const key = `${item.provider}:${item.providerId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(item);
    }
    return out;
}

function normalizeScope(scope?: string): AnimeScope {
    const tail = (scope ?? "SERIES").split(".").pop() ?? "SERIES";
    const normalized = tail.trim().toUpperCase();
    if (normalized === "MOVIES" || normalized === "HENTAI") return normalized;
    return "SERIES";
}

async function buildTypeGroup(params: {
    mediaType: MediaType;
    library: any[];
    hidden: Set<string>;
    seed: number;
    animeScope: AnimeScope;
}) {
    const { mediaType, library, hidden, seed, animeScope } = params;
    const typeLibrary = library.filter((item) => item.mediaType === mediaType);
    const topGenres = pickTopGenres(typeLibrary, 6);

    const recSeeds = [...typeLibrary]
        .filter((item) => item.status !== "PLANNED")
        .sort((a, b) => {
            const byRating = (b.yourRating ?? -1) - (a.yourRating ?? -1);
            if (byRating !== 0) return byRating;
            return b.updatedAt.getTime() - a.updatedAt.getTime();
        })
        .slice(0, 4);

    const becauseYouLike: any[] = [];
    for (const seedItem of recSeeds) {
        try {
            let source: any[] = [];
            if (seedItem.mediaType === "MOVIE" || seedItem.mediaType === "TV") {
                if (seedItem.provider !== "tmdb") continue;
                source = await tmdbRecommendations({
                    kind: seedItem.mediaType === "MOVIE" ? "movie" : "tv",
                    providerId: seedItem.providerId,
                });
            } else if (seedItem.mediaType === "ANIME") {
                if (seedItem.provider !== "anilist") continue;
                source = await anilistRecommendations(seedItem.providerId);
            }
            for (const item of source) {
                const key = `${item.provider}:${item.providerId}`;
                if (hidden.has(key)) continue;
                hidden.add(key);
                becauseYouLike.push({
                    ...item,
                    reason: {
                        type: "SEED_RECOMMENDATION",
                        seed: {
                            id: seedItem.id,
                            title: seedItem.title,
                            mediaType: seedItem.mediaType,
                        },
                    },
                });
                if (becauseYouLike.length >= 12) break;
            }
        } catch (error) {
            console.error("Suggestion seed recommendation failed:", error);
        }
        if (becauseYouLike.length >= 12) break;
    }

    const trendingInYourTaste: any[] = [];
    const tasteGenres = topGenres.slice(0, 3);
    try {
        if (mediaType === "MOVIE" || mediaType === "TV") {
            const rows = await tmdbDiscoverByGenres({
                kind: mediaType === "MOVIE" ? "movie" : "tv",
                genreNames: tasteGenres.length ? tasteGenres : ["Drama"],
                page: 1 + (seed % 3),
            });
            for (const row of rows) {
                const key = `${row.provider}:${row.providerId}`;
                if (hidden.has(key)) continue;
                hidden.add(key);
                trendingInYourTaste.push({
                    ...row,
                    reason: { type: "TRENDING_IN_YOUR_TASTE", genres: tasteGenres },
                });
                if (trendingInYourTaste.length >= 12) break;
            }
        } else if (mediaType === "ANIME") {
            const rows = await anilistDiscoverByGenres({
                genreNames: tasteGenres.length ? tasteGenres : ["Drama"],
                scope: animeScope,
                page: 1 + (seed % 3),
            });
            for (const row of rows) {
                const key = `${row.provider}:${row.providerId}`;
                if (hidden.has(key)) continue;
                hidden.add(key);
                trendingInYourTaste.push({
                    ...row,
                    reason: { type: "TRENDING_IN_YOUR_TASTE", genres: tasteGenres },
                });
                if (trendingInYourTaste.length >= 12) break;
            }
        } else if (mediaType === "BOOK") {
            const genre = (tasteGenres[0] ?? "fiction").split("/")[0].trim().toLowerCase() || "fiction";
            const rows = await googleBooksSearch(`subject:${genre}`);
            for (const row of rows) {
                const key = `${row.provider}:${row.providerId}`;
                if (hidden.has(key)) continue;
                hidden.add(key);
                trendingInYourTaste.push({
                    ...row,
                    reason: { type: "TRENDING_IN_YOUR_TASTE", genres: tasteGenres },
                });
                if (trendingInYourTaste.length >= 12) break;
            }
        }
    } catch (error) {
        console.error("Suggestion taste fallback failed:", error);
    }

    const quickPicks = uniqueByProvider([...becauseYouLike, ...trendingInYourTaste]).slice(0, 12);
    return {
        becauseYouLike: uniqueByProvider(becauseYouLike).slice(0, 12),
        trendingInYourTaste: uniqueByProvider(trendingInYourTaste).slice(0, 12),
        quickPicks,
        topGenres,
    };
}

suggestionsRouter.get(
    "/",
    asyncHandler(async (req, res) => {
        const query = parseOrThrow(
            z.object({
                mediaType: z.enum(MEDIA_TYPES).optional(),
                scope: z.string().optional(),
                refresh: z.coerce.number().optional(),
            }),
            req.query
        );

        const seed = query.refresh ?? daySeed();
        const animeScope = normalizeScope(query.scope);
        const cacheKey = `${Math.floor(Date.now() / SUG_TTL_MS)}:${query.mediaType ?? "ALL"}:${animeScope}:${seed}`;
        const cached = query.refresh ? null : cacheGet(cacheKey);
        if (cached) return res.json(cached);

        const [library, dismissed] = await Promise.all([
            prisma.mediaItem.findMany({
                select: {
                    id: true,
                    provider: true,
                    providerId: true,
                    mediaType: true,
                    status: true,
                    genres: true,
                    title: true,
                    yourRating: true,
                    updatedAt: true,
                },
                orderBy: [{ updatedAt: "desc" }],
                take: 600,
            }),
            prisma.suggestionDismissal.findMany({
                select: { provider: true, providerId: true },
            }),
        ]);

        const hiddenBase = new Set<string>([
            ...library.map((item) => `${item.provider}:${item.providerId}`),
            ...dismissed.map((item) => `${item.provider}:${item.providerId}`),
        ]);

        const typeList: readonly MediaType[] = query.mediaType ? [query.mediaType] : MEDIA_TYPES;
        const byType: Record<MediaType, any> = {
            MOVIE: { becauseYouLike: [], trendingInYourTaste: [], quickPicks: [], topGenres: [] },
            TV: { becauseYouLike: [], trendingInYourTaste: [], quickPicks: [], topGenres: [] },
            ANIME: { becauseYouLike: [], trendingInYourTaste: [], quickPicks: [], topGenres: [] },
            BOOK: { becauseYouLike: [], trendingInYourTaste: [], quickPicks: [], topGenres: [] },
        };

        for (const mediaType of typeList) {
            const hidden = new Set<string>(hiddenBase);
            byType[mediaType] = await buildTypeGroup({
                mediaType,
                library,
                hidden,
                seed,
                animeScope,
            });
        }

        const payload = {
            seed,
            scope: animeScope,
            byType,
        };
        if (!query.refresh) cacheSet(cacheKey, payload);
        res.json(payload);
    })
);

suggestionsRouter.post(
    "/dismiss",
    asyncHandler(async (req, res) => {
        const data = parseOrThrow(
            z.object({
                provider: z.string().min(1),
                mediaId: z.string().min(1),
                mediaType: z.enum(MEDIA_TYPES).optional(),
            }),
            req.body
        );
        await prisma.suggestionDismissal.upsert({
            where: {
                provider_providerId: {
                    provider: data.provider,
                    providerId: data.mediaId,
                },
            },
            create: {
                provider: data.provider,
                providerId: data.mediaId,
                mediaType: data.mediaType ?? null,
            },
            update: { mediaType: data.mediaType ?? null },
        });
        res.json({ ok: true });
    })
);

suggestionsRouter.delete(
    "/dismiss",
    asyncHandler(async (req, res) => {
        const data = parseOrThrow(
            z.object({
                provider: z.string().min(1),
                mediaId: z.string().min(1),
            }),
            req.query
        );
        await prisma.suggestionDismissal.deleteMany({
            where: { provider: data.provider, providerId: data.mediaId },
        });
        res.json({ ok: true });
    })
);

export default suggestionsRouter;
