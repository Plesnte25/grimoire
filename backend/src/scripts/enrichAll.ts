import { prisma } from "../db.js";
import { fetchEnrichment, saveEnrichment } from "../services/enrich.js";

// Backfill provider metadata for the whole library (Phase 1, KNOWN_ISSUES #19).
//
//   node dist/scripts/enrichAll.js [--all] [--type ANIME] [--limit 20] [--dry-run]
//
// Default: only items never checked (metaCheckedAt is null). --all re-fetches
// everything. --dry-run prints what would be written and saves nothing.

function arg(name: string) {
    const i = process.argv.indexOf(name);
    return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
    const all = process.argv.includes("--all");
    const dryRun = process.argv.includes("--dry-run");
    const type = arg("--type");
    const limit = Number(arg("--limit")) || undefined;

    const items = await prisma.mediaItem.findMany({
        where: { ...(all ? {} : { metaCheckedAt: null }), ...(type ? { mediaType: type } : {}) },
        orderBy: [{ mediaType: "asc" }, { title: "asc" }],
        take: limit,
    });
    console.log(`${items.length} items to enrich${dryRun ? " (dry run)" : ""}`);

    let ok = 0;
    const failed: string[] = [];
    for (const [i, item] of items.entries()) {
        const tag = `[${i + 1}/${items.length}] ${item.mediaType} ${item.title}`;
        try {
            const e = await fetchEnrichment(item);
            if (dryRun) {
                const d: any = e?.data ?? {};
                const show = [
                    d.franchiseId ? `franchise=${e?.franchise?.title} (${d.franchiseId}) role=${d.franchiseRole}` : "",
                    d.countryOfOrigin ? `country=${d.countryOfOrigin}` : "",
                    d.creator ? `creator=${d.creator}` : "",
                    d.seasons != null ? `seasons=${d.seasons}` : "",
                    d.airStatus ? `air=${d.airStatus}` : "",
                    d.announcedNext ? `next=${d.announcedNext} ${d.announcedNextDate?.toISOString?.().slice(0, 10) ?? "TBA"}` : "",
                    d.year != null ? `year=${d.year}` : "",
                    e ? `credits=${e.credits.length}` : "no provider data",
                ].filter(Boolean);
                console.log(`${tag} → ${show.join(" | ")}`);
            } else {
                await saveEnrichment(item, e);
                console.log(`${tag} ✓`);
            }
            ok++;
        } catch (err: any) {
            failed.push(item.title);
            console.error(`${tag} ✗ ${err?.message ?? err}`);
        }
    }
    console.log(`Done: ${ok} ok, ${failed.length} failed${failed.length ? `: ${failed.join(", ")}` : ""}`);
}

main().finally(() => prisma.$disconnect());
