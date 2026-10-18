import { prisma } from "../db.js";
import { externalIdCollisions, reconcileWorks, workDrift } from "../services/works.js";

// Phase 2 backfill: one Work + LibraryEntry + ExternalId set per MediaItem, and
// workId/Season links on existing Credit and Episode rows. Idempotent; the same
// reconcile also runs after the daily refresh to heal any missed dual-write.
//
//   node dist/scripts/backfillWorks.js          backfill, then print drift
//   node dist/scripts/backfillWorks.js --check      print drift only, write nothing
//   node dist/scripts/backfillWorks.js --preflight  list external ids claimed by more than
//                                                   one item (run on prod before the backfill)
//
// Exits non-zero if any drift remains, so it can gate the read-path switch.

async function main() {
    if (process.argv.includes("--preflight")) {
        const collisions = await externalIdCollisions();
        console.log(collisions.length ? "Collisions:" : "No external id collisions.");
        for (const c of collisions) console.log(`  ${c.source}:${c.externalId}`, c.items);
        process.exitCode = collisions.length ? 1 : 0;
        return;
    }
    if (!process.argv.includes("--check")) {
        const report = await reconcileWorks({
            onProgress: (done, total) => {
                if (done % 100 === 0 || done === total) console.log(`  ${done}/${total}`);
            },
        });
        console.log("Backfill:", { ...report, failed: report.failed.length });
        for (const line of report.failed) console.error("  failed:", line);
    }
    const drift = await workDrift();
    console.log("Drift:", drift);
    process.exitCode = Object.values(drift).some((n) => n > 0) ? 1 : 0;
}

main()
    .catch((err) => {
        console.error(err);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
