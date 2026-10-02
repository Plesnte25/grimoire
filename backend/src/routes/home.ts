import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { parseOrThrow } from "../utils/validate.js";

export const homeRouter = Router();

const TYPES = ["MOVIE", "TV", "ANIME", "BOOK"] as const;

homeRouter.get(
    "/",
    asyncHandler(async (_req, res) => {
        const now = new Date();
        const year = now.getUTCFullYear();
        const start = new Date(Date.UTC(year, 0, 1));
        const end = new Date(Date.UTC(year + 1, 0, 1));
        const [items, reminders, goals, logs, rewatchLogs, top10] = await Promise.all([
            prisma.mediaItem.findMany({
                where: { mediaType: { in: [...TYPES] } },
                orderBy: { updatedAt: "desc" },
                include: { reminder: true },
            }),
            prisma.reminder.findMany(),
            prisma.annualGoal.findMany({ where: { year } }),
            prisma.watchLog.findMany({
                where: { finishedAt: { gte: start, lt: end } },
                select: { mediaId: true, media: { select: { mediaType: true } } },
            }),
            prisma.watchLog.findMany({
                where: { finishedAt: { not: null } },
                select: { mediaId: true },
                distinct: ["mediaId"],
            }),
            prisma.customList.findMany({
                where: { kind: "TOP10" },
                orderBy: { mediaType: "asc" },
                include: { items: { include: { media: true }, orderBy: { order: "asc" }, take: 10 } },
            }),
        ]);

        const completedIds = new Map<string, Set<string>>();
        for (const log of logs) {
            for (const scope of ["ALL", log.media.mediaType]) {
                const ids = completedIds.get(scope) ?? new Set<string>();
                ids.add(log.mediaId);
                completedIds.set(scope, ids);
            }
        }
        const goalsWithProgress = goals.map((goal) => ({
            ...goal,
            completed: completedIds.get(goal.scope)?.size ?? 0,
        }));
        const liveReminders = new Map(
            reminders
                .filter((reminder) => reminder.pinned || !reminder.untilAt || reminder.untilAt > now)
                .map((reminder) => [reminder.mediaId, reminder])
        );
        const withReminder = items.map((item) => {
            const reminder = liveReminders.get(item.id);
            const aired = item.airedEpisodeCount ?? item.episodes ?? 0;
            const watched = item.progressValue ?? 0;
            return {
                ...item,
                reminder: reminder ? { pinned: reminder.pinned, untilAt: reminder.untilAt } : null,
                newEpisodeCount: item.status === "COMPLETED" ? 0 : Math.max(0, aired - watched),
            };
        });
        const hasCompletedLog = new Set(rewatchLogs.map((log) => log.mediaId));
        const notSnoozed = withReminder.filter((item) => !item.reminder?.untilAt || item.reminder.untilAt <= now || item.reminder.pinned);
        const readyToWatch = notSnoozed.filter((item) =>
            item.status === "PLANNED" &&
            !item.reminder?.pinned &&
            (!item.nextAirDate || item.nextAirDate <= now) &&
            (!item.announcedNextDate || item.announcedNextDate <= now) &&
            (!item.releaseDate || item.releaseDate <= now) &&
            (!item.digitalReleaseDate || item.digitalReleaseDate <= now)
        ).slice(0, 12);
        const comingSoon = notSnoozed.filter((item) =>
            item.status === "PLANNED" &&
            (item.reminder?.pinned || (item.nextAirDate && item.nextAirDate > now) || (item.announcedNextDate && item.announcedNextDate > now) || (item.releaseDate && item.releaseDate > now) || (item.digitalReleaseDate && item.digitalReleaseDate > now))
        ).slice(0, 12);
        const continueWatching = withReminder.filter((item) => item.status === "IN_PROGRESS").slice(0, 12);
        const rewatch = withReminder.filter((item) =>
            item.status === "COMPLETED" &&
            item.yourRating != null && item.yourRating >= 8 &&
            hasCompletedLog.has(item.id)
        ).slice(0, 8);

        res.json({ readyToWatch, comingSoon, continueWatching, rewatch, goals: goalsWithProgress, top10 });
    })
);

homeRouter.put(
    "/reminders/:mediaId",
    asyncHandler(async (req, res) => {
        const { mediaId } = parseOrThrow(z.object({ mediaId: z.string().min(1) }), req.params);
        const data = parseOrThrow(
            z.object({
                pinned: z.boolean().optional().default(false),
                untilAt: z.union([z.string().datetime(), z.null()]).optional(),
            }),
            req.body
        );
        const media = await prisma.mediaItem.findUnique({ where: { id: mediaId }, select: { id: true } });
        if (!media) return res.status(404).json({ error: "Title not found" });
        const reminder = await prisma.reminder.upsert({
            where: { mediaId },
            create: { mediaId, pinned: data.pinned, untilAt: data.untilAt ? new Date(data.untilAt) : null },
            update: { pinned: data.pinned, untilAt: data.untilAt ? new Date(data.untilAt) : null },
        });
        res.json({ reminder });
    })
);

homeRouter.delete(
    "/reminders/:mediaId",
    asyncHandler(async (req, res) => {
        const { mediaId } = parseOrThrow(z.object({ mediaId: z.string().min(1) }), req.params);
        await prisma.reminder.deleteMany({ where: { mediaId } });
        res.json({ ok: true });
    })
);

homeRouter.put(
    "/goals/:year/:scope",
    asyncHandler(async (req, res) => {
        const { year, scope } = parseOrThrow(
            z.object({
                year: z.coerce.number().int().min(2000).max(3000),
                scope: z.enum(["ALL", ...TYPES]),
            }),
            req.params
        );
        const { target } = parseOrThrow(z.object({ target: z.number().int().min(1).max(10000) }), req.body);
        const goal = await prisma.annualGoal.upsert({
            where: { year_scope: { year, scope } },
            create: { year, scope, target },
            update: { target },
        });
        res.json({ goal });
    })
);

homeRouter.delete(
    "/goals/:year/:scope",
    asyncHandler(async (req, res) => {
        const { year, scope } = parseOrThrow(
            z.object({
                year: z.coerce.number().int().min(2000).max(3000),
                scope: z.enum(["ALL", ...TYPES]),
            }),
            req.params
        );
        await prisma.annualGoal.deleteMany({ where: { year, scope } });
        res.json({ ok: true });
    })
);
