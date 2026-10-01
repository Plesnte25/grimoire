import { Router } from "express";
import { z } from "zod";
import { parseOrThrow } from "../utils/validate.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { tmdbSearch, tmdbDetails } from "../services/providers/tmdb.js";
import { anilistSearch, anilistDetails } from "../services/providers/anilist.js";
import { googleBooksSearch, googleBooksDetails } from "../services/providers/googleBooks.js";

export const providersRouter = Router();

providersRouter.get("/search", asyncHandler(async (req, res) => {
    const parsed = parseOrThrow(z.object({
        q: z.string().min(1),
        mediaType: z.string().optional()
    }), req.query);
    const q = parsed.q;
    const mediaType = parsed.mediaType;

    const services: Promise<any>[] = [];

    if (!mediaType) {
        // If no mediaType specified, search both movies and TV
        services.push(tmdbSearch(q, "movie"));
        services.push(tmdbSearch(q, "tv"));
    } else if (mediaType === "MOVIE") {
        services.push(tmdbSearch(q, "movie"));
    } else if (mediaType === "TV") {
        services.push(tmdbSearch(q, "tv"));
    }

    if (!mediaType || mediaType === "ANIME") {
        services.push(anilistSearch(q));
    }
    if (!mediaType || mediaType === "BOOK") {
        services.push(googleBooksSearch(q));
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
            details = await tmdbDetails(data.providerId, data.mediaType === "MOVIE" ? "movie" : "tv");
        } else if (data.provider === "anilist" && data.mediaType === "ANIME") {
            details = await anilistDetails(data.providerId);
        } else if (data.provider === "googlebooks" && data.mediaType === "BOOK") {
            details = await googleBooksDetails(data.providerId);
        }

        res.json({ details });
    } catch (err) {
        console.error("Provider details error:", err);
        res.status(502).json({ error: "Failed to fetch provider details" });
    }
}));
