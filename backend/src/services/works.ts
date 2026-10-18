import type { MediaItem, Prisma } from "@prisma/client";
import { prisma } from "../db.js";

// Phase 2 (expand): MediaItem is still the source of truth. Every write to it
// is mirrored into Work / ExternalId / LibraryEntry / FranchiseLink here. A Work
// reuses its MediaItem's id, so legacy mediaIds double as workIds.

type Db = Prisma.TransactionClient;

const MANAGED_SOURCES = ["tmdb", "anilist", "googlebooks", "manual", "imdb", "mal"];
const PRIMARY_CONFIDENCE = 1.0;
// Cross-provider links (TMDB record for an anime, MAL/IMDb ids) are matched by
// enrichment rather than chosen by the provider the item was added from.
const LINKED_CONFIDENCE = 0.8;

type IdCandidate = { source: string; externalId: string; confidence: number; isPrimary: boolean };

function tmdbKey(mediaType: string | null | undefined, id: string) {
    return `${mediaType === "MOVIE" ? "movie" : "tv"}:${id}`;
}

export function externalIdsFor(item: MediaItem): IdCandidate[] {
    const provider = item.provider.toLowerCase();
    const primary: IdCandidate =
        provider === "tmdb"
            ? { source: "tmdb", externalId: tmdbKey(item.mediaType, item.providerId), confidence: PRIMARY_CONFIDENCE, isPrimary: true }
            : { source: provider, externalId: item.providerId, confidence: PRIMARY_CONFIDENCE, isPrimary: true };

    const linked: IdCandidate[] = [];
    if (item.tmdbId && item.tmdbMediaType) {
        linked.push({ source: "tmdb", externalId: tmdbKey(item.tmdbMediaType, item.tmdbId), confidence: LINKED_CONFIDENCE, isPrimary: false });
    }
    if (item.imdbId) linked.push({ source: "imdb", externalId: item.imdbId, confidence: LINKED_CONFIDENCE, isPrimary: false });
    if (item.malId != null) linked.push({ source: "mal", externalId: String(item.malId), confidence: LINKED_CONFIDENCE, isPrimary: false });

    const out = new Map<string, IdCandidate>([[`${primary.source}|${primary.externalId}`, primary]]);
    for (const c of linked) if (!out.has(`${c.source}|${c.externalId}`)) out.set(`${c.source}|${c.externalId}`, c);
    return [...out.values()];
}

function eventForStatus(status: string) {
    if (status === "completed") return "completed";
    if (status === "dropped") return "dropped";
    if (status === "in_progress") return "started";
    return "status_changed";
}

/** Brings the Work side of one MediaItem in line with it (deleting the Work if the item is gone). */
export const DEFAULT_ACCOUNT = "singleton";

type SyncOptions = {
    // Live writes record WatchEvents and start/finish dates for real transitions;
    // backfill and reconcile only align state, so they never invent history.
    recordEvents?: boolean;
};

export async function syncWork(db: Db, mediaId: string, opts: SyncOptions = {}) {
    const item = await db.mediaItem.findUnique({ where: { id: mediaId } });
    if (!item) {
        await db.work.deleteMany({ where: { id: mediaId } });
        return;
    }

    const catalog = {
        type: item.mediaType.toLowerCase(),
        title: item.title,
        originalTitle: item.nativeTitle,
        year: item.year,
        country: item.countryOfOrigin,
        language: item.originalLanguage,
        overview: item.description,
        posterUrl: item.posterUrl,
    };
    await db.work.upsert({
        where: { id: item.id },
        create: { id: item.id, createdAt: item.createdAt, ...catalog },
        update: catalog,
    });

    const candidates = externalIdsFor(item);
    for (const c of candidates) {
        const key = { source_externalId: { source: c.source, externalId: c.externalId } };
        const existing = await db.externalId.findUnique({ where: key });
        if (!existing) {
            await db.externalId.create({ data: { workId: item.id, ...c } });
        } else if (existing.workId === item.id) {
            await db.externalId.update({ where: key, data: { confidence: c.confidence, isPrimary: c.isPrimary } });
        } else if (c.isPrimary) {
            // The provider id the item was added under beats another work's cross-link.
            // Surfaced because it can also mean the same title was added twice.
            console.warn(
                `ExternalId collision: ${c.source}:${c.externalId} belonged to work ${existing.workId}, now claimed by ${item.id} (possible duplicate)`
            );
            await db.externalId.update({ where: key, data: { workId: item.id, confidence: c.confidence, isPrimary: true } });
        }
    }
    await db.externalId.deleteMany({
        where: {
            workId: item.id,
            source: { in: MANAGED_SOURCES },
            NOT: { OR: candidates.map((c) => ({ source: c.source, externalId: c.externalId })) },
        },
    });

    const tracking = {
        status: item.status.toLowerCase(),
        score: item.yourRating,
        ratedAt: item.yourRatingAt,
        notes: item.yourNotes,
        rewatchCount: item.rewatchCount,
        legacyProgressValue: item.progressValue,
        legacyProgressSeason: item.progressSeason,
        legacyProgressEpisode: item.progressEpisode,
        legacyProgressTotal: item.progressTotalOverride,
        legacyProgressText: item.progressText,
        legacyCompletedSeasons: item.completedSeasonCount,
    };
    const accountKey = { accountId_workId: { accountId: DEFAULT_ACCOUNT, workId: item.id } };
    const entry = await db.libraryEntry.findUnique({ where: accountKey });
    if (!entry) {
        await db.libraryEntry.create({
            data: { accountId: DEFAULT_ACCOUNT, workId: item.id, createdAt: item.createdAt, ...tracking },
        });
    } else {
        const now = new Date();
        const dates: { startedAt?: Date; finishedAt?: Date } = {};
        const events: { type: string }[] = [];
        if (opts.recordEvents) {
            if (tracking.status !== entry.status) {
                events.push({ type: eventForStatus(tracking.status) });
                if (tracking.status === "in_progress" && !entry.startedAt) dates.startedAt = now;
                if (tracking.status === "completed" && !entry.finishedAt) dates.finishedAt = now;
            }
            if (tracking.rewatchCount > entry.rewatchCount) events.push({ type: "rewatched" });
        }
        await db.libraryEntry.update({ where: { id: entry.id }, data: { ...tracking, ...dates } });
        for (const e of events) await db.watchEvent.create({ data: { libraryEntryId: entry.id, type: e.type, occurredAt: now } });
    }

    if (item.franchiseId) {
        const link = { relation: item.franchiseRole?.toLowerCase() ?? "unknown", order: item.franchiseOrder };
        await db.franchiseLink.upsert({
            where: { workId_franchiseId: { workId: item.id, franchiseId: item.franchiseId } },
            create: { workId: item.id, franchiseId: item.franchiseId, ...link },
            update: link,
        });
    }
    await db.franchiseLink.deleteMany({
        where: { workId: item.id, ...(item.franchiseId ? { franchiseId: { not: item.franchiseId } } : {}) },
    });
}

/**
 * Dual-write entry point for routes. The legacy write has already succeeded and
 * stays authoritative, so a failure here is logged (and healed by the next
 * reconcile) rather than failing the request. Returns whether the Work is in place.
 */
export async function syncWorkSafe(mediaId: string): Promise<boolean> {
    try {
        await prisma.$transaction((tx) => syncWork(tx, mediaId, { recordEvents: true }));
        return true;
    } catch (err) {
        console.error(`Work sync failed for ${mediaId}:`, err);
        return false;
    }
}

/** Finds or creates the Season row for an episode-guide write (the Work must already exist). */
export async function ensureSeason(db: Db, workId: string, number: number) {
    const season = await db.season.upsert({
        where: { workId_number: { workId, number } },
        create: { workId, number },
        update: {},
        select: { id: true },
    });
    return season.id;
}

export type ReconcileReport = {
    items: number;
    works: number;
    libraryEntries: number;
    primaryExternalIds: number;
    orphanWorksRemoved: number;
    creditsLinked: number;
    episodesLinked: number;
    failed: string[];
};

/**
 * Idempotent backfill + drift repair: one Work / LibraryEntry / ExternalId set
 * per MediaItem, orphan Works removed, and Credit/Episode/Season links filled in.
 */
export async function reconcileWorks(opts: { onProgress?: (done: number, total: number) => void } = {}): Promise<ReconcileReport> {
    const ids = (await prisma.mediaItem.findMany({ select: { id: true }, orderBy: { createdAt: "asc" } })).map((i) => i.id);
    const failed: string[] = [];
    let done = 0;
    for (const id of ids) {
        try {
            await prisma.$transaction((tx) => syncWork(tx, id));
        } catch (err: any) {
            failed.push(`${id}: ${err?.message ?? err}`);
        }
        opts.onProgress?.(++done, ids.length);
    }

    const orphanWorksRemoved = await prisma.$executeRaw`DELETE FROM "Work" WHERE "id" NOT IN (SELECT "id" FROM "MediaItem")`;
    const creditsLinked = await prisma.$executeRaw`
        UPDATE "Credit" SET "workId" = "mediaId"
        WHERE "workId" IS NULL AND "mediaId" IN (SELECT "id" FROM "Work")`;
    const episodesLinked = await prisma.$executeRaw`
        UPDATE "Episode" SET "workId" = "mediaId"
        WHERE "workId" IS NULL AND "mediaId" IN (SELECT "id" FROM "Work")`;
    await prisma.$executeRaw`
        INSERT OR IGNORE INTO "Season" ("id", "workId", "number")
        SELECT lower(hex(randomblob(16))), "workId", "seasonNumber" FROM "Episode"
        WHERE "workId" IS NOT NULL GROUP BY "workId", "seasonNumber"`;
    await prisma.$executeRaw`
        UPDATE "Episode" SET "seasonId" = (
            SELECT s."id" FROM "Season" s WHERE s."workId" = "Episode"."workId" AND s."number" = "Episode"."seasonNumber")
        WHERE "seasonId" IS NULL AND "workId" IS NOT NULL`;

    const [works, libraryEntries, primaryExternalIds] = await Promise.all([
        prisma.work.count(),
        prisma.libraryEntry.count(),
        prisma.externalId.count({ where: { isPrimary: true } }),
    ]);
    return {
        items: ids.length,
        works,
        libraryEntries,
        primaryExternalIds,
        orphanWorksRemoved: Number(orphanWorksRemoved),
        creditsLinked: Number(creditsLinked),
        episodesLinked: Number(episodesLinked),
        failed,
    };
}

async function count(rows: Promise<{ n: bigint | number }[]>) {
    return Number((await rows)[0]?.n ?? 0);
}

/** Read-only drift summary: anything non-zero means the dual-write missed something. */
export async function workDrift() {
    return {
        itemsWithoutWork: await count(prisma.$queryRaw`
            SELECT COUNT(*) AS n FROM "MediaItem" WHERE "id" NOT IN (SELECT "id" FROM "Work")`),
        worksWithoutItem: await count(prisma.$queryRaw`
            SELECT COUNT(*) AS n FROM "Work" WHERE "id" NOT IN (SELECT "id" FROM "MediaItem")`),
        itemsWithoutLibraryEntry: await count(prisma.$queryRaw`
            SELECT COUNT(*) AS n FROM "MediaItem" WHERE "id" NOT IN (SELECT "workId" FROM "LibraryEntry")`),
        itemsWithoutPrimaryExternalId: await count(prisma.$queryRaw`
            SELECT COUNT(*) AS n FROM "MediaItem" WHERE "id" NOT IN (SELECT "workId" FROM "ExternalId" WHERE "isPrimary" = 1)`),
        trackingMismatches: await count(prisma.$queryRaw`
            SELECT COUNT(*) AS n FROM "LibraryEntry" le JOIN "MediaItem" m ON m."id" = le."workId"
            WHERE le."status" != lower(m."status")
               OR COALESCE(le."score", -1) != COALESCE(m."yourRating", -1)
               OR COALESCE(le."notes", '') != COALESCE(m."yourNotes", '')
               OR le."rewatchCount" != m."rewatchCount"
               OR COALESCE(le."legacyProgressValue", -1) != COALESCE(m."progressValue", -1)
               OR COALESCE(le."legacyProgressSeason", -1) != COALESCE(m."progressSeason", -1)
               OR COALESCE(le."legacyProgressEpisode", -1) != COALESCE(m."progressEpisode", -1)
               OR COALESCE(le."legacyProgressTotal", -1) != COALESCE(m."progressTotalOverride", -1)
               OR COALESCE(le."legacyProgressText", '') != COALESCE(m."progressText", '')
               OR COALESCE(le."legacyCompletedSeasons", -1) != COALESCE(m."completedSeasonCount", -1)`),
        catalogMismatches: await count(prisma.$queryRaw`
            SELECT COUNT(*) AS n FROM "Work" w JOIN "MediaItem" m ON m."id" = w."id"
            WHERE w."title" != m."title"
               OR w."type" != lower(m."mediaType")
               OR COALESCE(w."year", -1) != COALESCE(m."year", -1)
               OR COALESCE(w."posterUrl", '') != COALESCE(m."posterUrl", '')
               OR COALESCE(w."overview", '') != COALESCE(m."description", '')
               OR COALESCE(w."country", '') != COALESCE(m."countryOfOrigin", '')`),
        creditsWithoutWork: await count(prisma.$queryRaw`SELECT COUNT(*) AS n FROM "Credit" WHERE "workId" IS NULL`),
        episodesWithoutWork: await count(prisma.$queryRaw`SELECT COUNT(*) AS n FROM "Episode" WHERE "workId" IS NULL`),
        franchiseLinkMismatches: await count(prisma.$queryRaw`
            SELECT COUNT(*) AS n FROM "MediaItem" m
            WHERE m."franchiseId" IS NOT NULL
              AND m."id" NOT IN (SELECT "workId" FROM "FranchiseLink" WHERE "franchiseId" = m."franchiseId")`),
    };
}

/**
 * Read-only pre-flight for the backfill: groups every external id the items
 * would claim and reports the ones claimed by more than one item. Primary-id
 * duplicates are the dangerous ones (the later item takes the id over).
 */
export async function externalIdCollisions() {
    const items = await prisma.mediaItem.findMany();
    const claims = new Map<string, { source: string; externalId: string; items: { id: string; title: string; primary: boolean }[] }>();
    for (const item of items) {
        for (const c of externalIdsFor(item)) {
            const key = `${c.source}|${c.externalId}`;
            const entry = claims.get(key) ?? { source: c.source, externalId: c.externalId, items: [] };
            entry.items.push({ id: item.id, title: item.title, primary: c.isPrimary });
            claims.set(key, entry);
        }
    }
    return [...claims.values()].filter((c) => c.items.length > 1);
}
