import { prisma } from "../db.js";

/**
 * Simple suggestions:
 * 1) Continue (in-progress)
 * 2) Top genres from your high-rated completed items -> suggest from planned in same genres
 * 3) Oldest planned items (nudge)
 */
export async function getSuggestions(mediaType?: string) {
    const whereType = mediaType ? { mediaType } : {};

    const inProgress = await prisma.mediaItem.findMany({
        where: { ...whereType, status: "IN_PROGRESS" },
        orderBy: { updatedAt: "desc" },
        take: 10
    });

    const completedHigh = await prisma.mediaItem.findMany({
        where: { ...whereType, status: "COMPLETED", yourRating: { gte: 8 } },
        orderBy: { updatedAt: "desc" },
        take: 30
    });

    // count genres
    const genreCount = new Map<string, number>();
    for (const item of completedHigh) {
        const genres = item.genres ? (JSON.parse(item.genres) as string[]) : [];
        for (const g of genres) genreCount.set(g, (genreCount.get(g) ?? 0) + 1);
    }
    const topGenres = [...genreCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([g]) => g);

    const planned = await prisma.mediaItem.findMany({
        where: { ...whereType, status: "PLANNED" },
        orderBy: { createdAt: "asc" },
        take: 50
    });

    const byGenre = planned.filter((p: typeof planned[0]) => {
        const genres = p.genres ? (JSON.parse(p.genres) as string[]) : [];
        return genres.some(g => topGenres.includes(g));
    }).slice(0, 10);

    const oldestPlanned = planned.slice(0, 10);

    return {
        inProgress,
        becauseYouLike: byGenre,
        nudge: oldestPlanned,
        topGenres
    };
}
