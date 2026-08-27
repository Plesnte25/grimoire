import { prisma } from "../db.js";
import { anilistDetails } from "../services/providers/anilist.js";

function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
}

async function main() { 
    const items = await prisma.mediaItem.findMany({
        where: { mediaType: "ANIME", provider: "anilist", OR: [{ format: null }, { isAdult: null }, { nativeTitle: null }] },
        select: { id: true, providerId: true },
    });

    console.log("Need backfill:", items.length);

    for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const details = await anilistDetails(String(it.providerId));
        if (details) {
            await prisma.mediaItem.update({
                where: { id: it.id },
                data: {
                    format: details.format ?? null,
                    isAdult: details.isAdult ?? null,
                    nativeTitle: details.nativeTitle ?? null,
                    episodes: details.episodes ?? null,
                    duration: details.duration ?? null,
                },
            });
        }
        // stay WELL under AniList rate limit
        await sleep(1200);
    }

    console.log("Done.");
}

main().finally(() => prisma.$disconnect());
