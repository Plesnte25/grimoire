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

/** Brings the Work side of one MediaItem in line with it (deleting the Work if the item is gone). */
export async function syncWork(db: Db, mediaId: string) {
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
        notes: item.yourNotes,
        rewatchCount: item.rewatchCount,
    };
    await db.libraryEntry.upsert({
        where: { workId: item.id },
        create: { workId: item.id, createdAt: item.createdAt, ...tracking },
        update: tracking,
    });

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
        await prisma.$transaction((tx) => syncWork(tx, mediaId));
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
               OR le."rewatchCount" != m."rewatchCount"`),
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
