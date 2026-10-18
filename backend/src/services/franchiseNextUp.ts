import { prisma } from "../db.js";
import { DEFAULT_ACCOUNT } from "./works.js";

export type NextUpLink = {
    id: string;
    workId: string;
    isEssential: boolean;
    narrativeOrder: number | null;
    order: number | null;
    prerequisiteId: string | null;
    status: string | null; // LibraryEntry status, null if the work isn't in the library
};

export type NextUp = { link: NextUpLink; reason: "continue" | "start" };

function sortKey(l: NextUpLink) {
    // Curated order first, then legacy airing order, then a stable tiebreak.
    return [l.narrativeOrder ?? Infinity, l.order ?? Infinity] as const;
}

/**
 * The first essential entry you haven't completed whose prerequisite (if any) is
 * completed. An in-progress entry is "continue", anything else "start". A
 * prerequisite blocks its dependents even when it is not itself essential.
 */
export function pickNextUp(links: NextUpLink[]): NextUp | null {
    const byId = new Map(links.map((l) => [l.id, l]));
    const done = (l: NextUpLink | undefined) => l?.status === "completed";
    const ordered = [...links].sort((a, b) => {
        const [an, ao] = sortKey(a);
        const [bn, bo] = sortKey(b);
        return an - bn || ao - bo || a.id.localeCompare(b.id);
    });
    for (const link of ordered) {
        if (!link.isEssential || done(link)) continue;
        if (link.prerequisiteId && !done(byId.get(link.prerequisiteId))) continue;
        return { link, reason: link.status === "in_progress" ? "continue" : "start" };
    }
    return null;
}

export async function computeNextUp(franchiseId: string, accountId = DEFAULT_ACCOUNT): Promise<NextUp | null> {
    const rows = await prisma.franchiseLink.findMany({
        where: { franchiseId },
        include: { work: { select: { libraryEntries: { where: { accountId }, select: { status: true } } } } },
    });
    return pickNextUp(
        rows.map((r) => ({
            id: r.id,
            workId: r.workId,
            isEssential: r.isEssential,
            narrativeOrder: r.narrativeOrder,
            order: r.order,
            prerequisiteId: r.prerequisiteId,
            status: r.work.libraryEntries[0]?.status ?? null,
        }))
    );
}
