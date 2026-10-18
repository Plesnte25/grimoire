import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { prisma } from "../db.js";
import { applySpec, franchiseFileSchema, validateSpec } from "../services/franchiseCuration.js";

// Loads data/franchises/*.yaml into FranchiseLink rows (marked curated, so the
// MediaItem dual-write never overwrites them).
//
//   node dist/scripts/curateFranchise.js [--dry-run] [file.yaml ...]
//
// A work is its id or "<source>:<externalId>" for any ExternalId: "anilist:16498",
// "tmdb:tv:1429", "tmdb:movie:1429", "imdb:tt0944947", "mal:16498". Entries must
// already be in the library (they need a Work).

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../data/franchises");

async function curate(file: string, dryRun: boolean) {
    const spec = franchiseFileSchema.parse(parse(await readFile(file, "utf8")));
    let warnings: string[];
    if (dryRun) {
        const { problems, warnings: w, createsFranchise } = await validateSpec(spec);
        if (problems.length) throw new Error(problems.join("\n  "));
        warnings = w;
        if (createsFranchise) warnings.unshift(`would create franchise "${spec.franchise}" ("${spec.name}"); check for typos if you did not mean to create it.`);
        console.log(`${spec.name}: ${spec.entries.length} entries OK (dry run)`);
    } else {
        const result = await applySpec(spec);
        warnings = result.warnings;
        if (result.createdFranchise) warnings.unshift(`created franchise "${spec.franchise}" ("${spec.name}"); check for typos if you did not mean to create it.`);
        console.log(`${spec.name}: ${spec.entries.length} entries curated`);
    }
    for (const w of warnings) console.warn(`Warning: ${path.basename(file)}: ${w}`);
}

async function main() {
    const args = process.argv.slice(2);
    const dryRun = args.includes("--dry-run");
    const files = args.filter((a) => !a.startsWith("--"));
    const targets = files.length
        ? files
        : (await readdir(dir)).filter((f) => /\.ya?ml$/.test(f)).map((f) => path.join(dir, f));
    if (!targets.length) console.log(`No YAML files in ${dir}`);
    let failed = 0;
    for (const file of targets) {
        try {
            await curate(file, dryRun);
        } catch (err: any) {
            failed++;
            console.error(`${path.basename(file)}:\n  ${err?.message ?? err}`);
        }
    }
    process.exitCode = failed ? 1 : 0;
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
