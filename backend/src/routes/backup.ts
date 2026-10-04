import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { parseOrThrow } from "../utils/validate.js";

export const backupRouter = Router();

const MEDIA_TYPES = ["MOVIE", "TV", "ANIME", "BOOK"] as const;
const STATUSES = ["PLANNED", "IN_PROGRESS", "COMPLETED", "ON_HOLD", "DROPPED"] as const;
const dateInput = z.string().datetime().nullable().optional();
const importedLog = z.object({
    id: z.string().min(1),
    clientMutationId: z.string().uuid().nullable().optional(),
    startedAt: dateInput,
    finishedAt: dateInput,
    rating: z.number().nullable().optional(),
    review: z.string().nullable().optional(),
    reviewHasSpoilers: z.boolean().optional(),
    isRewatch: z.boolean().optional(),
    watchedOn: z.string().nullable().optional(),
    watchMode: z.enum(["SUB", "DUB", "ORIGINAL"]).nullable().optional(),
    watchedWith: z.string().nullable().optional(),
    fromEpisode: z.number().int().nullable().optional(),
    toEpisode: z.number().int().nullable().optional(),
    label: z.string().nullable().optional(),
});
const importedMedia = z.object({
    id: z.string().min(1),
    mediaType: z.enum(MEDIA_TYPES),
    provider: z.string().min(1),
    providerId: z.string().min(1),
    title: z.string().min(1),
    nativeTitle: z.string().nullable().optional(),
    format: z.string().nullable().optional(),
    isAdult: z.boolean().nullable().optional(),
    episodes: z.number().int().nullable().optional(),
    duration: z.number().int().nullable().optional(),
    year: z.number().int().nullable().optional(),
    description: z.string().nullable().optional(),
    posterUrl: z.string().nullable().optional(),
    backdropUrl: z.string().nullable().optional(),
    globalRating: z.number().nullable().optional(),
    globalRatingText: z.string().nullable().optional(),
    status: z.enum(STATUSES).optional(),
    yourRating: z.number().nullable().optional(),
    yourRatingAt: dateInput,
    yourNotes: z.string().nullable().optional(),
    progressText: z.string().nullable().optional(),
    progressValue: z.number().int().nullable().optional(),
    progressSeason: z.number().int().nullable().optional(),
    progressEpisode: z.number().int().nullable().optional(),
    progressTotalOverride: z.number().int().nullable().optional(),
    genres: z.string().nullable().optional(),
    countryOfOrigin: z.string().nullable().optional(),
    originalLanguage: z.string().nullable().optional(),
    region: z.string().nullable().optional(),
    regionOverride: z.string().nullable().optional(),
    creator: z.string().nullable().optional(),
    seasons: z.number().int().nullable().optional(),
    pageCount: z.number().int().nullable().optional(),
    isbn: z.string().nullable().optional(),
    releaseDate: dateInput,
    rewatchCount: z.number().int().min(0).optional(),
    watchLogs: z.array(importedLog).max(100000).optional(),
    tags: z.array(z.object({
        tag: z.object({
            name: z.string().min(1),
            kind: z.enum(["TAG", "MOOD"]).optional(),
            color: z.string().nullable().optional(),
        }),
    })).optional(),
});
const importSchema = z.object({
    version: z.literal(1),
    items: z.array(importedMedia).max(10000),
    lists: z.array(z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        description: z.string().nullable().optional(),
        coverColor: z.string().nullable().optional(),
        kind: z.enum(["LIST", "TOP10"]).optional(),
        mediaType: z.enum(MEDIA_TYPES).nullable().optional(),
        isRanked: z.boolean().optional(),
        items: z.array(z.object({
            mediaId: z.string().min(1),
            order: z.number().int(),
            note: z.string().nullable().optional(),
        })).optional(),
    })).max(10000),
    tierLists: z.array(z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        description: z.string().nullable().optional(),
        entries: z.array(z.object({
            mediaId: z.string().min(1),
            tier: z.enum(["S", "A", "B", "C", "D"]),
            order: z.number().int(),
        })).optional(),
    })).max(10000),
    // Legacy fields from old exports; accepted for backwards compatibility.
    goals: z.array(z.any()).optional(),
    reminders: z.array(z.any()).optional(),
});

function asDate(value?: string | null) {
    return value ? new Date(value) : null;
}

backupRouter.get("/export", asyncHandler(async (_req, res) => {
    const [items, lists, tierLists] = await Promise.all([
        prisma.mediaItem.findMany({ include: { tags: { include: { tag: true } } } }),
        prisma.customList.findMany({ include: { items: { select: { mediaId: true, order: true, note: true } } } }),
        prisma.tierList.findMany({ include: { entries: { select: { mediaId: true, tier: true, order: true } } } }),
    ]);
    res.setHeader("Content-Disposition", `attachment; filename="grimoire-backup-${new Date().toISOString().slice(0, 10)}.json"`);
    res.json({ version: 1, exportedAt: new Date().toISOString(), items, lists, tierLists });
}));

backupRouter.post("/import", asyncHandler(async (req, res) => {
    const backup = parseOrThrow(importSchema, req.body);
    const idMap = new Map<string, string>();
    await prisma.$transaction(async (tx) => {
        for (const source of backup.items) {
            const { id: sourceId, watchLogs = [], tags = [], ...data } = source;
            const finishedLogs = watchLogs
                .filter((entry) => !!entry.finishedAt)
                .sort((a, b) => {
                    const aTime = a.finishedAt ? new Date(a.finishedAt).getTime() : 0;
                    const bTime = b.finishedAt ? new Date(b.finishedAt).getTime() : 0;
                    return bTime - aTime;
                });
            const inferredRewatchCount = Math.max(0, finishedLogs.length - 1);
            const inferredRating =
                data.yourRating == null
                    ? (finishedLogs.find((entry) => entry.rating != null)?.rating ?? null)
                    : data.yourRating;
            const itemData = {
                ...data,
                status: data.status ?? "PLANNED",
                yourRating: inferredRating,
                yourRatingAt: inferredRating == null ? null : asDate(data.yourRatingAt) ?? new Date(),
                releaseDate: asDate(data.releaseDate),
                rewatchCount: Math.max(data.rewatchCount ?? inferredRewatchCount, inferredRewatchCount),
            };
            const item = await tx.mediaItem.upsert({
                where: { provider_providerId: { provider: data.provider, providerId: data.providerId } },
                create: itemData,
                update: itemData,
                select: { id: true },
            });
            idMap.set(sourceId, item.id);

            for (const entry of tags) {
                const tag = await tx.tag.upsert({
                    where: { name: entry.tag.name },
                    create: { name: entry.tag.name, kind: entry.tag.kind ?? "TAG", color: entry.tag.color ?? null },
                    update: { kind: entry.tag.kind ?? "TAG", color: entry.tag.color ?? null },
                    select: { id: true },
                });
                await tx.mediaTag.upsert({
                    where: { mediaId_tagId: { mediaId: item.id, tagId: tag.id } },
                    create: { mediaId: item.id, tagId: tag.id },
                    update: {},
                });
            }
        }

        for (const source of backup.lists) {
            const { items: entries = [], ...fields } = source;
            await tx.customList.upsert({
                where: { id: fields.id },
                create: fields,
                update: {
                    name: fields.name,
                    description: fields.description ?? null,
                    coverColor: fields.coverColor ?? null,
                    kind: fields.kind ?? "LIST",
                    mediaType: fields.mediaType ?? null,
                    isRanked: fields.isRanked ?? false,
                },
            });
            for (const entry of entries) {
                const mediaId = idMap.get(entry.mediaId);
                if (!mediaId) continue;
                await tx.listItem.upsert({
                    where: { listId_mediaId: { listId: fields.id, mediaId } },
                    create: { listId: fields.id, mediaId, order: entry.order, note: entry.note ?? null },
                    update: { order: entry.order, note: entry.note ?? null },
                });
            }
        }

        for (const source of backup.tierLists) {
            const { entries = [], ...fields } = source;
            await tx.tierList.upsert({
                where: { id: fields.id },
                create: fields,
                update: { name: fields.name, description: fields.description ?? null },
            });
            for (const entry of entries) {
                const mediaId = idMap.get(entry.mediaId);
                if (!mediaId) continue;
                await tx.tierEntry.upsert({
                    where: { tierListId_mediaId: { tierListId: fields.id, mediaId } },
                    create: { tierListId: fields.id, mediaId, tier: entry.tier, order: entry.order },
                    update: { tier: entry.tier, order: entry.order },
                });
            }
        }

    });

    res.json({ ok: true, importedItems: idMap.size });
}));
