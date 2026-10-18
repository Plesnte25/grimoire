import { prisma } from "../db.js";
import { enrichItem } from "./enrich.js";

const DAY_MS = 24 * 60 * 60 * 1000;

function pause(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function refreshDueMetadata() {
    const now = new Date();
    const airCutoff = new Date(now.getTime() - DAY_MS);
    const scoreCutoff = new Date(now.getTime() - 7 * DAY_MS);
    const due = await prisma.mediaItem.findMany({
        where: {
            OR: [
                {
                    mediaType: { in: ["TV", "ANIME"] },
                    OR: [{ airCheckedAt: null }, { airCheckedAt: { lt: airCutoff } }],
                },
                {
                    mediaType: "ANIME",
                    malId: { not: null },
                    malScore: null,
                    OR: [{ scoresCheckedAt: null }, { scoresCheckedAt: { lt: scoreCutoff } }],
                },
            ],
        },
        select: { id: true, title: true },
        orderBy: [{ airCheckedAt: "asc" }, { scoresCheckedAt: "asc" }],
        take: 100,
    });

    let failed = 0;
    for (const item of due) {
        const result = await enrichItem(item.id);
        if (!result.ok) {
            failed++;
            console.error(`Scheduled metadata refresh failed (${item.title}):`, result.error);
        }
        await pause(350);
    }
    console.info(`Scheduled metadata refresh finished: ${due.length - failed}/${due.length} titles updated`);
    return { attempted: due.length, failed };
}
