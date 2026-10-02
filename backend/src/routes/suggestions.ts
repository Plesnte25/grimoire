import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { parseOrThrow } from "../utils/validate.js";
import { asyncHandler } from "../utils/asyncHandler.js";

import { tmdbDiscoverByGenres } from "../services/providers/tmdb.js";
import { anilistDiscoverByGenres } from "../services/providers/anilist.js";
import { googleBooksSearch } from "../services/providers/googleBooks.js";
import { regionForCountry } from "../lib/regions.js";

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
            const weight = typeof it.yourRating === "number" ? Math.max(0.25, it.yourRating / 10) : 1;
            freq.set(key, (freq.get(key) ?? 0) + weight);
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

// Unbiased seeded shuffle (the old `.sort(() => rand() - 0.5)` pattern is not uniform).
function seededShuffle<T>(arr: T[], rand: () => number): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

suggestionsRouter.get("/", asyncHandler(async (req, res) => {
    const q = parseOrThrow(
        z.object({
            mediaType: z.enum(["MOVIE", "TV", "ANIME", "BOOK"]).optional(),
            cursor: z.string().optional(),
            // Sent only on an explicit Refresh click — forces a live re-fetch instead of
            // reusing the 2-minute cache bucket (see cacheKey below).
            refresh: z.coerce.number().optional(),
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
     * Bucket seed changes every 2 minutes, so organic page loads/navigation
     * don't hammer AniList/TMDB with completely new queries. An explicit
     * Refresh click sends `refresh` (its own timestamp), which seeds and
     * keys the cache independently so it always live-fetches.
     */
    const isExplicitRefresh = typeof q.refresh === "number";
    const bucket = Math.floor(Date.now() / SUG_TTL_MS);
    const cursor = q.cursor ?? String(bucket);

    const seedNum = isExplicitRefresh
        ? q.refresh! >>> 0
        : Number(String(cursor).replace(/\D/g, "").slice(-9)) || bucket;
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
            yourRating: true,
            isAdult: true,
            countryOfOrigin: true,
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
    const account = await prisma.accountConfig.findUnique({
        where: { id: 1 },
        select: { showAdultContent: true, watchCountry: true },
    });
    const preferredRegion = regionForCountry(account?.watchCountry);
    const visibleResults = (results: any[]) => results
        .filter((result) => account?.showAdultContent || !result.isAdult)
        .sort((a, b) => {
            if (!preferredRegion) return 0;
            const aPreferred = regionForCountry(a.countryOfOrigin) === preferredRegion ? 1 : 0;
            const bPreferred = regionForCountry(b.countryOfOrigin) === preferredRegion ? 1 : 0;
            return bPreferred - aPreferred;
        });

    // Shuffle top genres deterministically
    const shuffledTop = seededShuffle(topGenres, rand);
    const seedGenres = shuffledTop.slice(0, Math.max(1, Math.min(3, shuffledTop.length)));

    // Cache key depends on mediaType + scope + genre seed + bucket (or the refresh
    // seed on an explicit refresh, so it never collides with the organic-load bucket).
    const cacheKey = isExplicitRefresh
        ? `refresh:${seedNum}:${mediaType ?? "ALL"}:${scope}:${seedGenres.join("|")}`
        : `${bucket}:${mediaType ?? "ALL"}:${scope}:${seedGenres.join("|")}`;
    const cachedBecause = isExplicitRefresh ? null : sugGet(cacheKey);

    let becauseYouLike: any[] = [];
    if (cachedBecause !== null) {
        becauseYouLike = cachedBecause;
        const visible = visibleResults(becauseYouLike);
        return res.json({
            cursor,
            seed: seedNum,
            inProgress,
            becauseYouLike: visible,
            nudge: [],
            topGenres,
            results: visible,
        });
    }

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
            // Google Books categories are BISAC-style ("Fiction / Coming of Age") —
            // `subject:` wants a single simple term, so use just the top-level segment.
            const rawGenre = seedGenres[0] ?? "fiction";
            const genre = rawGenre.split("/")[0].trim().toLowerCase() || "fiction";
            const results = await googleBooksSearch(`subject:${genre}`);
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

    const visible = visibleResults(becauseYouLike);
    res.json({
        cursor,
        seed: seedNum,
        inProgress,
        becauseYouLike: visible,
        nudge: [],
        topGenres,
        // optional aggregate (helps frontend compatibility)
        results: visible,
    });
}));

export default suggestionsRouter;
