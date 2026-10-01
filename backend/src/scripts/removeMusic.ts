import { writeFileSync } from "node:fs";
import { prisma } from "../db.js";

// One-off: the Music category was removed (docs/KNOWN_ISSUES.md #45). Exports
// every MUSIC row, the list entries pointing at them, and the "Music playlist"
// lists to a JSON file, then deletes them in one transaction.
//
//   node dist/scripts/removeMusic.js <export-path.json> [--dry-run]

async function main() {
    const [outPath, flag] = process.argv.slice(2);
    if (!outPath) throw new Error("Usage: removeMusic <export-path.json> [--dry-run]");
    const dryRun = flag === "--dry-run";

    const items = await prisma.mediaItem.findMany({
        where: { mediaType: "MUSIC" },
        include: { listItems: true },
    });
    const playlists = await prisma.customList.findMany({
        where: { description: "Music playlist" },
        include: { items: true },
    });

    writeFileSync(
        outPath,
        JSON.stringify({ exportedAt: new Date().toISOString(), items, playlists }, null, 2)
    );
    const listItemCount = items.reduce((n, it) => n + it.listItems.length, 0);
    console.log(
        `Exported ${items.length} music items (${listItemCount} list entries) and ` +
            `${playlists.length} music playlists to ${outPath}`
    );

    if (dryRun) {
        console.log("Dry run, nothing deleted.");
        return;
    }

    const musicIds = new Set(items.map((it) => it.id));
    // Only drop a music playlist if nothing but music was ever in it.
    const playlistIds = playlists
        .filter((l) => l.items.every((li) => musicIds.has(li.mediaId)))
        .map((l) => l.id);

    // ListItem rows cascade from both MediaItem and CustomList.
    const [deletedItems, deletedLists] = await prisma.$transaction([
        prisma.mediaItem.deleteMany({ where: { mediaType: "MUSIC" } }),
        prisma.customList.deleteMany({ where: { id: { in: playlistIds } } }),
    ]);
    console.log(`Deleted ${deletedItems.count} music items and ${deletedLists.count} playlists.`);
}

main().finally(() => prisma.$disconnect());
