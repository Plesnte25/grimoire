import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { z } from "zod";
import { prisma } from "../db.js";

// Loads data/franchises/*.yaml into FranchiseLink rows (marked curated, so the
// MediaItem dual-write never overwrites them).
//
//   node dist/scripts/curateFranchise.js [--dry-run] [file.yaml ...]
//
// A work is referenced by its id, or "<provider>:<providerId>" ("anilist:16498",
// "tmdb:1429"). Entries must already be in the library (they need a Work).

const entrySchema = z.object({
    work: z.string().min(1),
    relation: z.enum(["main", "movie", "ova", "ona", "special", "sequel", "prequel", "spin_off"]),
    narrativeOrder: z.number().int().optional(),
    isEssential: z.boolean().default(true),
    prerequisite: z.string().min(1).optional(),
});
const fileSchema = z.object({
    name: z.string().min(1),
    franchise: z.string().min(1), // Franchise.id (AniList id of the root series)
    entries: z.array(entrySchema).min(1),
});

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../data/franchises");

async function resolveWork(ref: string) {
    const byId = await prisma.work.findUnique({ where: { id: ref }, select: { id: true, title: true } });
    if (byId) return byId;
    const [provider, ...rest] = ref.split(":");
    if (!rest.length) return null;
    const item = await prisma.mediaItem.findFirst({
        where: { provider, providerId: rest.join(":") },
        select: { id: true, title: true },
    });
    return item;
}

async function curate(file: string, dryRun: boolean) {
    const spec = fileSchema.parse(parse(await readFile(file, "utf8")));
    const franchise = await prisma.franchise.findUnique({ where: { id: spec.franchise }, select: { id: true } });
    if (!franchise) throw new Error(`${file}: franchise ${spec.franchise} not found`);

    const resolved = new Map<string, { id: string; title: string }>();
    const refs = new Set(spec.entries.flatMap((e) => [e.work, ...(e.prerequisite ? [e.prerequisite] : [])]));
    const problems: string[] = [];
    for (const ref of refs) {
        const work = await resolveWork(ref);
        if (work) resolved.set(ref, work);
        else problems.push(`unknown work "${ref}"`);
    }
    const members = new Set(spec.entries.map((e) => e.work));
    for (const e of spec.entries) {
        if (e.prerequisite && !members.has(e.prerequisite)) problems.push(`prerequisite "${e.prerequisite}" is not an entry of this franchise`);
        if (e.prerequisite === e.work) problems.push(`"${e.work}" cannot be its own prerequisite`);
    }
    if (problems.length) throw new Error(`${file}:\n  ${problems.join("\n  ")}`);

    const prereqOf = new Map(spec.entries.map((e) => [e.work, e.prerequisite]));
    for (const start of prereqOf.keys()) {
        const seen = new Set([start]);
        for (let cur = prereqOf.get(start); cur; cur = prereqOf.get(cur)) {
            if (seen.has(cur)) throw new Error(`${file}: prerequisite cycle through "${cur}"`);
            seen.add(cur);
        }
    }
    if (dryRun) {
        console.log(`${spec.name}: ${spec.entries.length} entries OK (dry run)`);
        return;
    }

    await prisma.$transaction(async (tx) => {
        const linkIds = new Map<string, string>();
        for (const e of spec.entries) {
            const workId = resolved.get(e.work)!.id;
            const data = { relation: e.relation, narrativeOrder: e.narrativeOrder ?? null, isEssential: e.isEssential, curated: true, prerequisiteId: null };
            const link = await tx.franchiseLink.upsert({
                where: { workId_franchiseId: { workId, franchiseId: spec.franchise } },
                create: { workId, franchiseId: spec.franchise, ...data },
                update: data,
                select: { id: true },
            });
            linkIds.set(e.work, link.id);
        }
        for (const e of spec.entries) {
            if (!e.prerequisite) continue;
            await tx.franchiseLink.update({ where: { id: linkIds.get(e.work)! }, data: { prerequisiteId: linkIds.get(e.prerequisite)! } });
        }
    });
    console.log(`${spec.name}: ${spec.entries.length} entries curated`);
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
            console.error(err?.message ?? err);
        }
    }
    process.exitCode = failed ? 1 : 0;
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
