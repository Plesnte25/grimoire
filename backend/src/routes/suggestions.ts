import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { parseOrThrow } from "../utils/validate.js";

import { tmdbDiscoverByGenres } from "../services/providers/tmdb";
import { anilistDiscoverByGenres } from "../services/providers/anilist";
import { googleBooksDiscoverByIds } from "../services/providers/googleBooks";
import { itunesDiscoverByIds } from "../services/providers/itunes";

export const suggestionsRouter = Router();

/**
 * Cache ONLY the "becauseYouLike" block.
 * We still compute library-driven pieces (topGenres, inProgress) live.
 */
const SUG_CACHE = new Map<string, { at: number; data: any[] }>();
const SUG_TTL_MS = 2 * 60 * 1000; // 2 minutes

function sugGet(key: string) {
    const v = SUG_CACHE.get(key);
    if (!v) return null;
    if (Date.now() - v.at > SUG_TTL_MS) {
        SUG_CACHE.delete(key);
        return null;
    }
    return v.data;
}
function sugSet(key: string, data: any[]) {
    SUG_CACHE.set(key, { at: Date.now(), data });
}

function safeParseGenres(genres: any): string[] {
    if (!genres) return [];
    if (Array.isArray(genres)) return genres.map(String).filter(Boolean);

    if (typeof genres === "string") {
        const g = genres.trim();

        // stored JSON array string?
        if (g.startsWith("[") && g.endsWith("]")) {
            try {
                const parsed = JSON.parse(g);
                if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
            } catch {
                // ignore
            }
        }

        return g
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean);
    }

    return [];
}

function pickTopGenres(items: any[], max = 6): string[] {
    const freq = new Map<string, number>();
    for (const it of items) {
        for (const g of safeParseGenres(it.genres)) {
            const key = String(g);
            freq.set(key, (freq.get(key) ?? 0) + 1);
        }
    }
    return [...freq.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, max)
        .map(([g]) => g);
}

// Deterministic PRNG
function mulberry32(seed: number) {
    return function () {
        let t = (seed += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

suggestionsRouter.get("/", async (req, res) => {
    const q = parseOrThrow(
        z.object({
            mediaType: z.enum(["MOVIE", "TV", "ANIME", "BOOK", "MUSIC"]).optional(),
            cursor: z.string().optional(),
            scope: z.preprocess((val) => {
                if (typeof val !== "string") return val;

                // accepts: "SERIES", "series", "anime.series", "anime.movies", etc.
                const last = val.split(".").pop() ?? val;
                return last.trim().toUpperCase();
            }, z.enum(["SERIES", "MOVIES", "HENTAI"])).optional(),
        }),
        req.query
    );

    const mediaType = q.mediaType;
    const scope = (q.scope ?? "SERIES") as "SERIES" | "MOVIES" | "HENTAI";

    /**
     * Bucket seed changes every 2 minutes, so repeated refreshes
     * don't hammer AniList/TMDB with completely new queries. 
     */
    const bucket = Math.floor(Date.now() / SUG_TTL_MS);
    const cursor = q.cursor ?? String(bucket);

    const seedNum = Number(String(cursor).replace(/\D/g, "").slice(-9)) || bucket;
    const rand = mulberry32(seedNum);

    // Pull from library to compute "because you like" seeds
    const library = await prisma.mediaItem.findMany({
        where: mediaType ? { mediaType } : undefined,
        select: {
            id: true,
            provider: true,
            providerId: true,
            mediaType: true,
            status: true,
            genres: true,
            title: true,
            year: true,
            posterUrl: true,
            backdropUrl: true,
            globalRating: true,
            globalRatingText: true,
            description: true,
            createdAt: true,
            updatedAt: true,
        },
        orderBy: { updatedAt: "desc" },
        take: 400,
    });

    const existing = new Set(library.map((x) => `${x.provider}:${x.providerId}`));

    const inProgress = library.filter((x) => x.status === "IN_PROGRESS").slice(0, 12);
    const topGenres = pickTopGenres(library, 6);

    // Shuffle top genres deterministically
    const shuffledTop = [...topGenres].sort(() => rand() - 0.5);
    const seedGenres = shuffledTop.slice(0, Math.max(1, Math.min(3, shuffledTop.length)));

    // Cache key depends on mediaType + scope + genre seed + bucket
    const cacheKey = `${bucket}:${mediaType ?? "ALL"}:${scope}:${seedGenres.join("|")}`;
    const cachedBecause = sugGet(cacheKey);

    let becauseYouLike: any[] = [];

    try {
        if (mediaType === "MOVIE" || mediaType === "TV") {
            const kind = mediaType === "MOVIE" ? "movie" : "tv";
            const page = 1 + Math.floor(rand() * 3); // smaller range reduces variance

            const results = await tmdbDiscoverByGenres({
                kind,
                genreNames: seedGenres.length ? seedGenres : ["Drama"],
                page,
            });

            becauseYouLike = results
                .filter((r: any) => !existing.has(`${r.provider}:${r.providerId}`))
                .slice(0, 12);

            sugSet(cacheKey, becauseYouLike);
        } else if (mediaType === "ANIME") {
            const page = 1 + Math.floor(rand() * 3);

            const results = await anilistDiscoverByGenres({
                genreNames: seedGenres.length ? seedGenres : ["Drama"],
                page,
                scope,
            });

            becauseYouLike = results
                .filter((r: any) => !existing.has(`${r.provider}:${r.providerId}`))
                .slice(0, 12);

            sugSet(cacheKey, becauseYouLike);
        } else if (mediaType === "BOOK") {
            const base = 100000 + Math.floor(rand() * 500000);
            const ids = Array.from({ length: 12 }, (_, i) => String(base + i * 13));

            const results = await googleBooksDiscoverByIds(ids);
            becauseYouLike = results
                .filter((r: any) => !existing.has(`${r.provider}:${r.providerId}`))
                .slice(0, 12);

            sugSet(cacheKey, becauseYouLike);
        } else if (mediaType === "MUSIC") {
            const base = 100000000 + Math.floor(rand() * 50000000);
            const ids = Array.from({ length: 12 }, (_, i) => String(base + i * 31));

            const results = await itunesDiscoverByIds(ids);
            becauseYouLike = results
                .filter((r: any) => !existing.has(`${r.provider}:${r.providerId}`))
                .slice(0, 12);

            sugSet(cacheKey, becauseYouLike);
        } else {
            // mediaType omitted → no suggestions
            becauseYouLike = [];
        }
    } catch (e) {
        console.error("Suggestions generation failed:", e);

        // ✅ fallback to cached to avoid empty bar
        becauseYouLike = cachedBecause ?? [];
    }

    res.json({
        cursor,
        seed: seedNum,
        inProgress,
        becauseYouLike,
        nudge: [],
        topGenres,
        // optional aggregate (helps frontend compatibility)
        results: becauseYouLike,
    });
});

export default suggestionsRouter;
