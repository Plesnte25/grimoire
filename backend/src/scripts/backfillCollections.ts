import { prisma } from "../db.js";
import { tmdbDetails } from "../services/providers/tmdb.js";
import { anilistDetails } from "../services/providers/anilist.js";
import { itunesLookupById } from "../services/providers/itunes.js";

function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
}

async function main() {
    const items = await prisma.mediaItem.findMany({
        where: { collectionId: null },
        select: { id: true, provider: true, providerId: true, mediaType: true },
    });

    console.log("Need collection backfill:", items.length);

    for (const it of items) {
        try {
            let patch: {
                collectionId: string;
                collectionName?: string;
                collectionSource: string;
            } | null = null;

            if (it.provider === "tmdb" && it.mediaType === "MOVIE") {
                const d = await tmdbDetails(it.providerId, "movie");
                if (d?.collectionId) {
                    patch = {
                        collectionId: d.collectionId,
                        collectionName: d.collectionName,
                        collectionSource: "tmdb",
                    };
                }
            } else if (it.provider === "anilist") {
                const d = await anilistDetails(it.providerId);
                if ((d as any)?.collectionId) {
                    patch = {
                        collectionId: (d as any).collectionId,
                        collectionName: (d as any).collectionName,
                        collectionSource: "anilist",
                    };
                }
            } else if (it.provider === "itunes") {
                const d = await itunesLookupById(it.providerId);
                if ((d as any)?.collectionId) {
                    patch = {
                        collectionId: (d as any).collectionId,
                        collectionName: (d as any).collectionName,
                        collectionSource: "itunes",
                    };
                }
            }

            if (patch) {
                await prisma.mediaItem.update({ where: { id: it.id }, data: patch });
            }
        } catch (e) {
            console.error("backfill failed for", it.id, e);
        }

        // stay well under each provider's rate limit
        await sleep(it.provider === "anilist" ? 1200 : 300);
    }

    console.log("Done.");
}

main().finally(() => prisma.$disconnect());
