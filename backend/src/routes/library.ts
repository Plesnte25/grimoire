import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { parseOrThrow } from "../utils/validate.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { enrichWithinBudget } from "../services/enrich.js";
import { isFinished, progressTotal } from "../lib/progress.js";
import { itemLogsRouter } from "./logs.js";
import { setItemTags } from "./tags.js";
import { effectiveRegion, regionForItem } from "../lib/regions.js";
import { randomUUID } from "node:crypto";
import { tmdbGet } from "../services/providers/tmdb.js";

export const libraryRouter = Router();

// Shared shape of library items: the franchise card data and tag names.
const ITEM_INCLUDE = {
    franchise: { select: { title: true, posterUrl: true, bannerUrl: true } },
    tags: { select: { tag: { select: { id: true, name: true, kind: true, color: true } } } },
    reminder: { select: { pinned: true, untilAt: true } },
} as const;

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
        const { mediaType, status, region } = parseOrThrow(
            z.object({
                mediaType: z.enum(["MOVIE", "TV", "ANIME", "BOOK"]).optional(),
                status: z.string().optional(),
                // A regional category: its shows and films.
                region: z.enum(["TR", "PK", "KR", "EU"]).optional(),
            }),
            req.query
        );

        const where: any = {};
        if (region) where.mediaType = { in: ["TV", "MOVIE"] };
        else if (mediaType) where.mediaType = mediaType;
        if (status) where.status = status;

        // Library reads are DB-only: provider metadata is stored when an item is
        // added (or by scripts/enrichAll), never fetched per request.
        const items = await prisma.mediaItem.findMany({
            where,
            orderBy: [{ updatedAt: "desc" }],
            include: ITEM_INCLUDE,
        });

        // Regional shows move out of TV into their region's category; regional
        // films stay in Movies as well (decided 2026-10-01).
        const visible = region
            ? items.filter((it) => effectiveRegion(it) === region)
            : mediaType === "TV"
                ? items.filter((it) => !effectiveRegion(it))
                : items;
        const out = visible.map(withParsedGenres);

        res.json({ items: out });
    })
);

libraryRouter.use("/:id/logs", itemLogsRouter);
libraryRouter.put("/:id/tags", setItemTags);

// Seasons of a TMDB show, for the season → episode progress picker.
libraryRouter.get(
    "/:id/seasons",
    asyncHandler(async (req, res) => {
        const item = await prisma.mediaItem.findUnique({ where: { id: req.params.id } });
        if (!item) return res.status(404).json({ error: "Not found" });
        const tmdbId = item.provider === "tmdb" && item.mediaType === "TV"
            ? item.providerId
            : item.mediaType === "ANIME" && item.tmdbMediaType === "TV"
              ? item.tmdbId
              : null;
        if (!tmdbId) return res.json({ seasons: [] });
        const show = await tmdbGet(`/tv/${tmdbId}`);
        const seasons = (show?.seasons ?? [])
            .filter((s: any) => s.season_number >= 1)
            .map((s: any) => ({
                season: s.season_number,
                name: s.name,
                episodes: s.episode_count ?? 0,
                airDate: s.air_date ?? null,
            }));
        res.json({ seasons });
    })
);

libraryRouter.get(
    "/:id/seasons/:season/episodes",
    asyncHandler(async (req, res) => {
        const { season } = parseOrThrow(
            z.object({ season: z.coerce.number().int().min(1).max(100) }),
            req.params
        );
        const item = await prisma.mediaItem.findUnique({ where: { id: req.params.id } });
        if (!item) return res.status(404).json({ error: "Not found" });
        if (item.mediaType !== "TV" && item.mediaType !== "ANIME") {
            return res.json({ episodes: [], available: false });
        }

        const cached = await prisma.episode.findMany({
            where: { mediaId: item.id, seasonNumber: season },
            orderBy: { episodeNumber: "asc" },
        });
        const cacheStatus = await prisma.episodeSeasonCache.findUnique({
            where: { mediaId_seasonNumber: { mediaId: item.id, seasonNumber: season } },
        });
        if (cacheStatus && Date.now() - cacheStatus.checkedAt.getTime() < 7 * 24 * 60 * 60 * 1000) {
            return res.json({ episodes: cached, available: true });
        }
        const tmdbId = item.provider === "tmdb" && item.mediaType === "TV"
            ? item.providerId
            : item.tmdbId && item.tmdbMediaType === "TV"
              ? item.tmdbId
              : null;
        if (!tmdbId) return res.json({ episodes: cached, available: cached.length > 0 });

        const remote = await tmdbGet<{
            episodes?: {
                episode_number: number;
                name?: string;
                overview?: string;
                air_date?: string;
                runtime?: number;
                still_path?: string;
            }[];
        }>(`/tv/${tmdbId}/season/${season}`);
        if (!remote || !Array.isArray(remote.episodes)) {
            return res.json({ episodes: cached, available: cached.length > 0 });
        }

        const rows = remote.episodes
            .filter((episode) => Number.isInteger(episode.episode_number) && episode.episode_number > 0)
            .map((episode) => ({
                mediaId: item.id,
                seasonNumber: season,
                episodeNumber: episode.episode_number,
                name: String(episode.name || `Episode ${episode.episode_number}`),
                overview: episode.overview || null,
                airDate: episode.air_date && /^\d{4}-\d{2}-\d{2}$/.test(episode.air_date)
                    ? new Date(`${episode.air_date}T00:00:00.000Z`)
                    : null,
                runtime: Number.isInteger(episode.runtime) ? episode.runtime : null,
                stillUrl: episode.still_path
                    ? `https://image.tmdb.org/t/p/w300${episode.still_path}`
                    : null,
            }));
        await prisma.$transaction(async (tx) => {
            await tx.episode.deleteMany({ where: { mediaId: item.id, seasonNumber: season } });
            await tx.episode.createMany({ data: rows });
            await tx.episodeSeasonCache.upsert({
                where: { mediaId_seasonNumber: { mediaId: item.id, seasonNumber: season } },
                create: { mediaId: item.id, seasonNumber: season },
                update: { checkedAt: new Date() },
            });
        });
        const episodes = await prisma.episode.findMany({
            where: { mediaId: item.id, seasonNumber: season },
            orderBy: { episodeNumber: "asc" },
        });
        res.json({ episodes, available: true });
    })
);

libraryRouter.get(
    "/:id",
    asyncHandler(async (req, res) => {
        const include = {
            ...ITEM_INCLUDE,
            credits: {
                orderBy: [{ role: "asc" as const }, { order: "asc" as const }],
                include: { contributor: { select: { id: true, name: true, kind: true, imageUrl: true } } },
            },
        };
        let item = await prisma.mediaItem.findUnique({ where: { id: req.params.id }, include });
        if (!item) return res.status(404).json({ error: "Not found" });

        // Items added before Phase 1 (or whose enrichment failed) get it here. A short
        // budget: opening a page shouldn't wait on a slow or rate-limited provider.
        if (!item.metaCheckedAt && item.provider !== "manual") {
            await enrichWithinBudget(item.id, 2500);
            item = (await prisma.mediaItem.findUnique({ where: { id: item.id }, include })) ?? item;
        }

        const out = withParsedGenres(item);
        res.json({ item: out });
    })
);

libraryRouter.post(
    "/",
    asyncHandler(async (req, res) => {
        const schema = z.object({
            mediaType: z.enum(["MOVIE", "TV", "ANIME", "BOOK"]),
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

            collectionId: nonEmptyString,
            collectionName: nonEmptyString,
            countryOfOrigin: z.string().length(2).toUpperCase().optional(),
            originalLanguage: nonEmptyString,
        });

        const body = { ...req.body };
        // Manual entries (not on any provider) get a generated id.
        if (body.provider === "manual" && !body.providerId) body.providerId = `manual-${randomUUID()}`;
        const data = parseOrThrow(schema, body);

        let mediaTypeNormalized = data.mediaType as any;
        const provider = (data.provider ?? "").toLowerCase();
        if (provider === "anilist") mediaTypeNormalized = "ANIME";
        if (provider === "googlebooks") mediaTypeNormalized = "BOOK";

        const existed = await prisma.mediaItem.findUnique({
            where: { provider_providerId: { provider: data.provider, providerId: data.providerId } },
        });

        const genreString = serializeGenres(data.genres ?? []);
        const origin = {
            countryOfOrigin: data.countryOfOrigin,
            originalLanguage: data.originalLanguage,
            region: data.countryOfOrigin ? regionForItem(mediaTypeNormalized, data.countryOfOrigin) : undefined,
        };
        const collectionSource = data.collectionId ? provider : undefined;

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
                collectionId: data.collectionId,
                collectionName: data.collectionName,
                collectionSource,
                ...origin,
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
                collectionId: data.collectionId,
                collectionName: data.collectionName,
                collectionSource,
                ...origin,
                // Nothing to fetch for manual entries.
                ...(provider === "manual" ? { metaCheckedAt: new Date() } : {}),
            },
        });

        if (!item.metaCheckedAt && item.provider !== "manual") {
            await enrichWithinBudget(item.id);
        }
        const fresh = await prisma.mediaItem.findUnique({
            where: { id: item.id },
            include: ITEM_INCLUDE,
        });

        res.json({ item: withParsedGenres(fresh ?? item), alreadyExisted: !!existed });
    })
);

// PATCH fields that can be cleared: "" or null → null, missing → unchanged.
const clearableText = z
    .union([z.string(), z.null()])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === null || v.trim() === "" ? null : v.trim()));

const clearableInt = z
    .union([z.number().int().min(0), z.string(), z.null()])
    .optional()
    .transform((v) => {
        if (v === undefined || v === null) return v;
        const n = typeof v === "number" ? v : Number(String(v));
        return Number.isInteger(n) && n >= 0 ? n : undefined;
    });

libraryRouter.patch(
    "/:id",
    asyncHandler(async (req, res) => {
        const schema = z.object({
            status: z.enum(["PLANNED", "IN_PROGRESS", "COMPLETED", "ON_HOLD", "DROPPED"]).optional(),
            // null clears the rating ("Not rated"); 0.5–10 in half steps otherwise.
            yourRating: z
                .union([z.number(), z.string(), z.null()])
                .optional()
                .transform((v) => {
                    if (v === undefined || v === null) return v;
                    const n = typeof v === "number" ? v : Number(String(v));
                    return Number.isFinite(n) ? n : undefined;
                })
                .refine((v) => v == null || (v >= 0.5 && v <= 10 && Number.isInteger(v * 2)), {
                    message: "Rating must be 0.5–10 in half steps",
                }),
            yourNotes: clearableText,
            progressText: clearableText,
            progressValue: clearableInt,
            progressSeason: clearableInt,
            progressEpisode: clearableInt,
            progressTotalOverride: clearableInt,
            regionOverride: z.enum(["TR", "PK", "KR", "EU", "NONE"]).nullable().optional(),
            // Editable on manual entries only (provider items are kept in sync).
            title: z.string().trim().min(1).optional(),
            year: z.number().int().min(1800).max(3000).nullable().optional(),
            countryOfOrigin: z.string().length(2).toUpperCase().nullable().optional(),
            episodes: z.number().int().min(1).nullable().optional(),
            posterUrl: z.string().url().nullable().optional(),
            genres: z
                .union([z.array(z.string()), z.string()])
                .optional()
                .transform((val) => (val === undefined ? undefined : normalizeGenresInput(val))),
        });

        const data = parseOrThrow(schema, req.body);
        const current = await prisma.mediaItem.findUnique({ where: { id: req.params.id } });
        if (!current) return res.status(404).json({ error: "Not found" });

        const updateData: any = { ...data };
        if (data.yourRating !== undefined) {
            updateData.yourRatingAt = data.yourRating == null ? null : new Date();
        }
        if (data.genres !== undefined) {
            updateData.genres = serializeGenres(data.genres);
        }
        const manualFields = ["title", "year", "countryOfOrigin", "episodes", "posterUrl"] as const;
        if (current.provider !== "manual" && manualFields.some((f) => data[f] !== undefined)) {
            const err: any = new Error("Only manually added items can have their details edited");
            err.status = 400;
            err.code = "NOT_MANUAL";
            throw err;
        }
        if (data.countryOfOrigin !== undefined) {
            updateData.region = regionForItem(current.mediaType, data.countryOfOrigin);
        }

        // Reaching the last unit of something that can't grow completes it.
        const merged = { ...current, ...updateData };
        const total = progressTotal(merged);
        if (
            data.status === undefined &&
            data.progressValue != null &&
            total != null &&
            data.progressValue >= total &&
            current.status !== "COMPLETED" &&
            isFinished(merged)
        ) {
            updateData.status = "COMPLETED";
        }

        const statusChange =
            updateData.status !== undefined && updateData.status !== current.status ? updateData.status : null;

        if (statusChange === "COMPLETED") {
            if (total != null && data.progressValue === undefined) updateData.progressValue = total;
            if (current.mediaType === "TV") {
                updateData.completedSeasonCount = current.seasons ?? current.lastAiredSeason ?? null;
                if (data.progressSeason === undefined && current.lastAiredSeason != null) {
                    updateData.progressSeason = current.lastAiredSeason;
                    updateData.progressEpisode = current.lastAiredEpisode;
                }
            }
        }

        const ops: any[] = [prisma.mediaItem.update({ where: { id: current.id }, data: updateData })];

        // Keep the watch log in step with status: Watching opens an entry,
        // Completed closes it (or records one if you never marked it Watching).
        const openLog = await prisma.watchLog.findFirst({
            where: { mediaId: current.id, finishedAt: null },
            orderBy: { createdAt: "desc" },
        });
        const now = new Date();
        if (statusChange === "IN_PROGRESS" && !openLog) {
            const finishedBefore = await prisma.watchLog.count({
                where: { mediaId: current.id, finishedAt: { not: null } },
            });
            ops.push(
                prisma.watchLog.create({
                    data: { mediaId: current.id, startedAt: now, isRewatch: finishedBefore > 0 },
                })
            );
        }
        if (statusChange === "COMPLETED") {
            const rating = updateData.yourRating ?? current.yourRating ?? null;
            ops.push(
                openLog
                    ? prisma.watchLog.update({ where: { id: openLog.id }, data: { finishedAt: now, rating } })
                    : prisma.watchLog.create({ data: { mediaId: current.id, finishedAt: now, rating } })
            );
        }

        const [item] = await prisma.$transaction(ops);
        res.json({ item: withParsedGenres(item) });
    })
);

libraryRouter.post(
    "/:id/tmdb-link",
    asyncHandler(async (req, res) => {
        const data = parseOrThrow(
            z.object({ tmdbId: z.string().regex(/^\d+$/), tmdbMediaType: z.enum(["MOVIE", "TV"]) }),
            req.body
        );
        const item = await prisma.mediaItem.findUnique({ where: { id: req.params.id } });
        if (!item) return res.status(404).json({ error: "Not found" });
        if (item.mediaType !== "ANIME" || item.provider !== "anilist") {
            const err: any = new Error("Only AniList anime can be linked to a TMDB record");
            err.status = 400;
            err.code = "INVALID_MEDIA_TYPE";
            throw err;
        }

        const tmdbType = data.tmdbMediaType === "MOVIE" ? "movie" : "tv";
        const details = await tmdbGet(
            `/${tmdbType}/${data.tmdbId}`,
            { append_to_response: "external_ids" }
        );
        if (!details) {
            const err: any = new Error("TMDB record not found");
            err.status = 404;
            err.code = "TMDB_NOT_FOUND";
            throw err;
        }
        const isAnimation = (details.genres ?? []).some(
            (genre: { id?: number; name?: string }) => genre.id === 16 || genre.name?.toLowerCase() === "animation"
        );
        if (!isAnimation) {
            const err: any = new Error("The selected TMDB record is not categorized as animation");
            err.status = 422;
            err.code = "TMDB_NOT_ANIMATION";
            throw err;
        }

        const linked = await prisma.mediaItem.update({
            where: { id: item.id },
            data: {
                tmdbId: data.tmdbId,
                tmdbMediaType: data.tmdbMediaType,
                imdbId: details.external_ids?.imdb_id ?? item.imdbId,
            },
        });
        res.json({ item: linked });
    })
);

libraryRouter.delete(
    "/:id",
    asyncHandler(async (req, res) => {
        await prisma.mediaItem.delete({ where: { id: req.params.id } });
        res.json({ ok: true });
    })
);
