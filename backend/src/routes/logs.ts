import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { parseOrThrow } from "../utils/validate.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Watch/read history: one WatchLog per watch (KNOWN_ISSUES #50, #51, #70).
export const logsRouter = Router();

const dateField = z
    .union([z.string(), z.null()])
    .optional()
    .transform((v, ctx) => {
        if (v === undefined || v === null) return v;
        const d = new Date(v);
        if (Number.isNaN(d.getTime())) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid date" });
            return z.NEVER;
        }
        return d;
    });

const text = z
    .union([z.string(), z.null()])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === null || v.trim() === "" ? null : v.trim()));

export const logSchema = z.object({
    startedAt: dateField,
    finishedAt: dateField,
    rating: z
        .number()
        .refine((v) => v >= 0.5 && v <= 10 && Number.isInteger(v * 2), "Rating must be 0.5–10 in half steps")
        .nullable()
        .optional(),
    review: text,
    reviewHasSpoilers: z.boolean().optional(),
    isRewatch: z.boolean().optional(),
    watchedOn: text,
    watchMode: z.enum(["SUB", "DUB", "ORIGINAL"]).nullable().optional(),
    watchedWith: text,
    fromEpisode: z.number().int().positive().nullable().optional(),
    toEpisode: z.number().int().positive().nullable().optional(),
    label: text,
}).refine(
    (data) => data.fromEpisode == null || data.toEpisode == null || data.fromEpisode <= data.toEpisode,
    { message: "Episode range must start at or before it ends", path: ["toEpisode"] }
);

/** A rating given in a log is also your current rating for the item. */
async function syncItemRating(mediaId: string, rating: number | null | undefined) {
    if (rating === undefined) return;
    await prisma.mediaItem.update({
        where: { id: mediaId },
        data: { yourRating: rating, yourRatingAt: rating == null ? null : new Date() },
    });
}

logsRouter.patch(
    "/:logId",
    asyncHandler(async (req, res) => {
        const data = parseOrThrow(logSchema, req.body);
        const log = await prisma.watchLog.update({ where: { id: req.params.logId }, data });
        await syncItemRating(log.mediaId, data.rating);
        res.json({ log });
    })
);

logsRouter.delete(
    "/:logId",
    asyncHandler(async (req, res) => {
        await prisma.watchLog.delete({ where: { id: req.params.logId } });
        res.json({ ok: true });
    })
);

// Diary: everything finished in a year, newest first, with the item summary.
logsRouter.get(
    "/",
    asyncHandler(async (req, res) => {
        const { year } = parseOrThrow(
            z.object({ year: z.coerce.number().int().min(1900).max(3000).optional() }),
            req.query
        );
        const y = year ?? new Date().getUTCFullYear();
        const logs = await prisma.watchLog.findMany({
            where: { finishedAt: { gte: new Date(Date.UTC(y, 0, 1)), lt: new Date(Date.UTC(y + 1, 0, 1)) } },
            orderBy: { finishedAt: "desc" },
            include: {
                media: { select: { id: true, title: true, mediaType: true, posterUrl: true, year: true } },
            },
        });
        res.json({ year: y, logs });
    })
);

// Mounted on the library router: /api/library/:id/logs
export const itemLogsRouter = Router({ mergeParams: true });

itemLogsRouter.get(
    "/",
    asyncHandler(async (req, res) => {
        const logs = await prisma.watchLog.findMany({
            where: { mediaId: (req.params as any).id },
            orderBy: [{ finishedAt: "desc" }, { createdAt: "desc" }],
        });
        res.json({ logs });
    })
);

itemLogsRouter.post(
    "/",
    asyncHandler(async (req, res) => {
        const mediaId = (req.params as any).id as string;
        const { clientMutationId, ...data } = parseOrThrow(
            logSchema.and(z.object({ clientMutationId: z.string().uuid().optional() })),
            req.body
        );
        const earlier = await prisma.watchLog.count({ where: { mediaId, finishedAt: { not: null } } });
        const logData = { ...data, mediaId, isRewatch: data.isRewatch ?? earlier > 0 };
        const log = clientMutationId
            ? await prisma.watchLog.upsert({
                  where: { clientMutationId },
                  create: { ...logData, clientMutationId },
                  update: {},
              })
            : await prisma.watchLog.create({ data: logData });
        if (log.mediaId !== mediaId) {
            const err: any = new Error("This client mutation id belongs to another title");
            err.status = 409;
            err.code = "IDEMPOTENCY_KEY_CONFLICT";
            throw err;
        }
        await syncItemRating(mediaId, data.rating);
        res.json({ log });
    })
);
