import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { parseOrThrow } from "../utils/validate.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { anilistDetails } from "../services/providers/anilist.js";

export const libraryRouter = Router();

function normalizeGenresInput(input: unknown): string[] {
    if (!input) return [];

    if (Array.isArray(input)) {
        return input.map(String).map((s) => s.trim()).filter(Boolean);
    }

    if (typeof input === "string") {
        const s = input.trim();
        if (!s) return [];

        try {
            const parsed = JSON.parse(s);
            if (Array.isArray(parsed)) {
                return parsed.map(String).map((x) => x.trim()).filter(Boolean);
            }
        } catch { }

        return s
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean);
    }

    return [];
}

function serializeGenres(genres: string[]): string | null {
    const clean = (genres || []).map((g) => g.trim()).filter(Boolean);
    if (!clean.length) return null;
    return JSON.stringify(clean);
}

function deserializeGenres(stored: unknown): string[] {
    if (!stored) return [];
    if (Array.isArray(stored)) {
        return stored.map(String).map((s) => s.trim()).filter(Boolean);
    }
    if (typeof stored !== "string") return [];

    const s = stored.trim();
    if (!s) return [];

    try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) {
            return parsed.map(String).map((x) => x.trim()).filter(Boolean);
        }
    } catch { }

    return s
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
}

function withParsedGenres<T extends { genres?: any }>(item: T): T & { genres: string[] } {
    return {
        ...item,
        genres: deserializeGenres(item.genres),
    };
}

const nonEmptyString = z
    .string()
    .optional()
    .transform((v) => {
        const s = (v ?? "").trim();
        return s.length ? s : undefined;
    });

const yearSchema = z
    .union([z.number().int(), z.string()])
    .optional()
    .transform((v) => {
        if (v === undefined) return undefined;
        if (typeof v === "number") return v;
        const n = Number(String(v).trim());
        return Number.isFinite(n) ? n : undefined;
    });

libraryRouter.get(
    "/",
    asyncHandler(async (req, res) => {
        const mediaType = req.query.mediaType as string | undefined;
        const status = req.query.status as string | undefined;

        const where: any = {};
        if (mediaType) where.mediaType = mediaType;
        if (status) where.status = status;

        const items = await prisma.mediaItem.findMany({
            where,
            orderBy: [{ updatedAt: "desc" }],
        });

        let out = items.map(withParsedGenres);

        if (mediaType === "ANIME") {
            out = await Promise.all(
                out.map(async (it: any) => {
                    // Only enrich if the DB does NOT have format/isAdult stored yet
                    if (it.format || typeof it.isAdult === "boolean" || it.nativeTitle) return it;
                    if ((it.provider ?? "").toLowerCase() !== "anilist") return it;

                    try {
                        const details = await anilistDetails(String(it.providerId));
                        return details ? { ...it, ...details } : it;
                    } catch {
                        return it;
                    }
                })
            );
        }


        res.json({ items: out });
    })
);

libraryRouter.get(
    "/:id",
    asyncHandler(async (req, res) => {
        const item = await prisma.mediaItem.findUnique({ where: { id: req.params.id } });
        if (!item) return res.status(404).json({ error: "Not found" });

        let out: any = withParsedGenres(item);
        if (out.mediaType === "ANIME" && String(out.provider ?? "").toLowerCase() === "anilist") {
            try {
                const details = await anilistDetails(String(out.providerId));
                if (details) out = { ...out, ...details };
            } catch { }
        }

        res.json({ item: out });
    })
);

libraryRouter.post(
    "/",
    asyncHandler(async (req, res) => {
        const schema = z.object({
            mediaType: z.enum(["MOVIE", "TV", "ANIME", "BOOK", "MUSIC"]),
            provider: z.string(),
            providerId: z.string(),
            title: z.string().min(1),
            nativeTitle: nonEmptyString,
            format: nonEmptyString,
            isAdult: z.boolean().optional(),
            episodes: z.union([z.number().int(), z.string()]).optional().transform((v) => {
                if (v === undefined) return undefined;
                const n = typeof v === "number" ? v : Number(String(v));
                return Number.isFinite(n) ? n : undefined;
            }),
            duration: z.union([z.number().int(), z.string()]).optional().transform((v) => {
                if (v === undefined) return undefined;
                const n = typeof v === "number" ? v : Number(String(v));
                return Number.isFinite(n) ? n : undefined;
            }),

            year: yearSchema,
            description: nonEmptyString,

            posterUrl: nonEmptyString,
            backdropUrl: nonEmptyString,

            genres: z
                .union([z.array(z.string()), z.string()])
                .optional()
                .transform((val) => normalizeGenresInput(val)),

            globalRating: z
                .union([z.number(), z.string()])
                .optional()
                .transform((v) => {
                    if (v === undefined) return undefined;
                    const n = typeof v === "number" ? v : Number(String(v));
                    return Number.isFinite(n) ? n : undefined;
                }),

            globalRatingText: nonEmptyString,
        });

        const data = parseOrThrow(schema, req.body);

        let mediaTypeNormalized = data.mediaType as any;
        const provider = (data.provider ?? "").toLowerCase();
        if (provider === "anilist") mediaTypeNormalized = "ANIME";
        if (provider === "itunes") mediaTypeNormalized = "MUSIC";
        if (provider === "googlebooks") mediaTypeNormalized = "BOOK";

        const existed = await prisma.mediaItem.findUnique({
            where: { provider_providerId: { provider: data.provider, providerId: data.providerId } },
        });

        const genreString = serializeGenres(data.genres ?? []);

        const item = await prisma.mediaItem.upsert({
            where: { provider_providerId: { provider: data.provider, providerId: data.providerId } },
            update: {
                mediaType: mediaTypeNormalized,
                title: data.title,
                nativeTitle: data.nativeTitle,
                format: data.format,
                isAdult: data.isAdult,
                episodes: data.episodes,
                duration: data.duration,
                year: data.year,
                description: data.description,
                posterUrl: data.posterUrl,
                backdropUrl: data.backdropUrl,
                genres: genreString,
                globalRating: data.globalRating,
                globalRatingText: data.globalRatingText,
            },
            create: {
                mediaType: mediaTypeNormalized,
                provider: data.provider,
                providerId: data.providerId,
                title: data.title,
                nativeTitle: data.nativeTitle,
                format: data.format,
                isAdult: data.isAdult,
                episodes: data.episodes,
                duration: data.duration,
                year: data.year,
                description: data.description,
                posterUrl: data.posterUrl,
                backdropUrl: data.backdropUrl,
                genres: genreString,
                globalRating: data.globalRating,
                globalRatingText: data.globalRatingText,
            },
        });

        res.json({ item: withParsedGenres(item), alreadyExisted: !!existed });
    })
);

libraryRouter.patch(
    "/:id",
    asyncHandler(async (req, res) => {
        const schema = z.object({
            status: z.enum(["PLANNED", "IN_PROGRESS", "COMPLETED", "ON_HOLD", "DROPPED"]).optional(),
            yourRating: z
                .union([z.number(), z.string()])
                .optional()
                .transform((v) => {
                    if (v === undefined) return undefined;
                    const n = typeof v === "number" ? v : Number(String(v));
                    return Number.isFinite(n) ? n : undefined;
                }),
            yourNotes: nonEmptyString,
            progressText: nonEmptyString,
            progressValue: z
                .union([z.number().int(), z.string()])
                .optional()
                .transform((v) => {
                    if (v === undefined) return undefined;
                    const n = typeof v === "number" ? v : Number(String(v));
                    return Number.isFinite(n) ? n : undefined;
                }),
            genres: z
                .union([z.array(z.string()), z.string()])
                .optional()
                .transform((val) => (val === undefined ? undefined : normalizeGenresInput(val))),
        });

        const data = parseOrThrow(schema, req.body);
        const updateData: any = { ...data };

        if (data.genres !== undefined) {
            updateData.genres = serializeGenres(data.genres);
        }

        const item = await prisma.mediaItem.update({
            where: { id: req.params.id },
            data: updateData,
        });

        res.json({ item: withParsedGenres(item) });
    })
);

libraryRouter.delete(
    "/:id",
    asyncHandler(async (req, res) => {
        await prisma.mediaItem.delete({ where: { id: req.params.id } });
        res.json({ ok: true });
    })
);
