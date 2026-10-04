import { Router } from "express";
import { z } from "zod";
import { parseOrThrow } from "../utils/validate.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { withTimeout } from "../utils/withTimeout.js";
import { regionForCountry } from "../lib/regions.js";
import { tmdbSearch, tmdbDetails } from "../services/providers/tmdb.js";
import { anilistSearch, anilistDetails } from "../services/providers/anilist.js";
import { googleBooksSearch, googleBooksDetails } from "../services/providers/googleBooks.js";
import { prisma } from "../db.js";
import { tmdbGet, TMDB_IMAGE_BASE } from "../services/providers/tmdb.js";

export const providersRouter = Router();

// Interactive search/add calls must return well inside the frontend's axios
// timeout even if a provider (usually AniList — see the serialized request
// queue in services/providers/anilist.ts) is slow or backed up.
const SEARCH_TIMEOUT_MS = 9000;

const providerResultCache = new Map<string, { expiresAt: number; data: unknown }>();

function fromCache<T>(key: string): T | null {
    const value = providerResultCache.get(key);
    if (!value) return null;
    if (value.expiresAt <= Date.now()) {
        providerResultCache.delete(key);
        return null;
    }
    return value.data as T;
}

function toCache(key: string, data: unknown) {
    if (providerResultCache.size > 500) providerResultCache.clear();
    providerResultCache.set(key, { expiresAt: Date.now() + 12 * 60 * 60 * 1000, data });
}

async function linkedTmdb(mediaId: string) {
    const item = await prisma.mediaItem.findUnique({ where: { id: mediaId } });
    if (!item) return { item: null, id: null, type: null };
    const id = item.provider === "tmdb" ? item.providerId : item.tmdbId;
    const type = item.provider === "tmdb"
        ? (item.mediaType === "MOVIE" ? "movie" : item.mediaType === "TV" ? "tv" : null)
        : item.tmdbMediaType === "MOVIE" ? "movie" : item.tmdbMediaType === "TV" ? "tv" : null;
    return { item, id: id && type ? id : null, type };
}

providersRouter.get("/media/:mediaId/watch", asyncHandler(async (req, res) => {
    const { mediaId, country } = parseOrThrow(z.object({
        mediaId: z.string().min(1),
        country: z.string().regex(/^[A-Za-z]{2}$/).transform((value) => value.toUpperCase()),
    }), { ...req.params, ...req.query });
    const { item, id, type } = await linkedTmdb(mediaId);
    if (!item) return res.status(404).json({ error: "Title not found" });
    if (!id || !type) return res.json({ available: false, providers: [], link: null });

    const cacheKey = `watch:${id}:${type}:${country}`;
    const cached = fromCache<{ available: boolean; providers: unknown[]; link: string | null }>(cacheKey);
    if (cached) return res.json(cached);

    type Region = {
        link?: string;
        flatrate?: { provider_id: number; provider_name: string; logo_path?: string | null }[];
        rent?: { provider_id: number; provider_name: string; logo_path?: string | null }[];
        buy?: { provider_id: number; provider_name: string; logo_path?: string | null }[];
    };
    const response = await tmdbGet<{ results?: Record<string, Region> }>(
        `/${type}/${id}/watch/providers`
    );
    const region = response?.results?.[country];
    const providers = [
        ...(region?.flatrate ?? []).map((provider) => ({ provider, availability: "flatrate" as const })),
        ...(region?.rent ?? []).map((provider) => ({ provider, availability: "rent" as const })),
        ...(region?.buy ?? []).map((provider) => ({ provider, availability: "buy" as const })),
    ].map(({ provider, availability }) => ({
        id: provider.provider_id,
        name: provider.provider_name,
        logoUrl: provider.logo_path ? `${TMDB_IMAGE_BASE}/w92${provider.logo_path}` : null,
        availability,
    }));
    const result = { available: !!region, providers, link: region?.link ?? null };
    toCache(cacheKey, result);
    res.json(result);
}));

providersRouter.get("/media/:mediaId/trailers", asyncHandler(async (req, res) => {
    const { mediaId } = parseOrThrow(z.object({ mediaId: z.string().min(1) }), req.params);
    const { item, id, type } = await linkedTmdb(mediaId);
    if (!item) return res.status(404).json({ error: "Title not found" });
    if (!id || !type) return res.json({ available: false, trailers: [] });

    const cacheKey = `trailers:${id}:${type}`;
    const cached = fromCache<{ available: boolean; trailers: unknown[] }>(cacheKey);
    if (cached) return res.json(cached);
    const response = await tmdbGet<{ results?: { id: string; name: string; site: string; key: string; type: string }[] }>(
        `/${type}/${id}/videos`
    );
    const trailers = (response?.results ?? [])
        .filter((video) => video.site === "YouTube" && (video.type === "Trailer" || video.type === "Teaser"))
        .slice(0, 8)
        .map((video) => ({ id: video.id, name: video.name, type: video.type, url: `https://www.youtube.com/watch?v=${encodeURIComponent(video.key)}` }));
    const result = { available: !!response, trailers };
    toCache(cacheKey, result);
    res.json(result);
}));

providersRouter.get("/search", asyncHandler(async (req, res) => {
    const parsed = parseOrThrow(z.object({
        q: z.string().min(1),
        mediaType: z.string().optional(),
        // From a regional category: shows + films, that region's titles first.
        region: z.enum(["TR", "PK", "KR", "EU"]).optional(),
    }), req.query);
    const q = parsed.q;
    const mediaType = parsed.region ? undefined : parsed.mediaType;

    // Each provider is bounded so a single slow/rate-limited one (most often
    // AniList, whose requests are serialized behind a shared queue — see
    // services/providers/anilist.ts) can't stall the whole search past the
    // frontend's request timeout; a timed-out provider just contributes no
    // results instead of blocking the others.
    const bound = (p: Promise<any>, label: string) => withTimeout(p, SEARCH_TIMEOUT_MS, label);
    const services: Promise<any>[] = [];

    if (!mediaType) {
        // If no mediaType specified, search both movies and TV
        services.push(bound(tmdbSearch(q, "movie"), "tmdb movie search"));
        services.push(bound(tmdbSearch(q, "tv"), "tmdb tv search"));
    } else if (mediaType === "MOVIE") {
        services.push(bound(tmdbSearch(q, "movie"), "tmdb movie search"));
    } else if (mediaType === "TV") {
        services.push(bound(tmdbSearch(q, "tv"), "tmdb tv search"));
    }

    if (!parsed.region && (!mediaType || mediaType === "ANIME")) {
        services.push(bound(anilistSearch(q), "anilist search"));
    }
    if (!parsed.region && (!mediaType || mediaType === "BOOK")) {
        services.push(bound(googleBooksSearch(q), "google books search"));
    }

    const settled = await Promise.allSettled(services);
    const results: any[] = [];
    for (const s of settled) {
        if (s.status === "fulfilled" && Array.isArray(s.value)) {
            results.push(...s.value);
        } else if (s.status === "rejected") {
            console.error("Provider search failed:", s.reason);
        }
    }

    if (parsed.region) {
        const inRegion = (r: any) => regionForCountry(r.countryOfOrigin) === parsed.region;
        results.sort((a, b) => Number(inRegion(b)) - Number(inRegion(a)) || (b.popularity ?? 0) - (a.popularity ?? 0));
    }

    // Merge results. Frontend will show type badges.
    res.json({ results });
}));

providersRouter.get("/details", asyncHandler(async (req, res) => {
    const data = parseOrThrow(z.object({
        provider: z.string(),
        providerId: z.string(),
        mediaType: z.enum(["MOVIE", "TV", "ANIME", "BOOK"])
    }), req.query);

    try {
        let details: any = null;
        if (data.provider === "tmdb" && (data.mediaType === "MOVIE" || data.mediaType === "TV")) {
            details = await withTimeout(tmdbDetails(data.providerId, data.mediaType === "MOVIE" ? "movie" : "tv"), SEARCH_TIMEOUT_MS, "tmdb details");
        } else if (data.provider === "anilist" && data.mediaType === "ANIME") {
            details = await withTimeout(anilistDetails(data.providerId), SEARCH_TIMEOUT_MS, "anilist details");
        } else if (data.provider === "googlebooks" && data.mediaType === "BOOK") {
            details = await withTimeout(googleBooksDetails(data.providerId), SEARCH_TIMEOUT_MS, "google books details");
        }

        res.json({ details });
    } catch (err) {
        console.error("Provider details error:", err);
        res.status(502).json({ error: "Failed to fetch provider details" });
    }
}));
