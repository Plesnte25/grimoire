import { z } from "zod";
import { prisma } from "../db.js";
import { DEFAULT_ACCOUNT } from "./works.js";

const entrySchema = z.object({
    work: z.string().min(1),
    relation: z.enum(["main", "movie", "ova", "ona", "special", "sequel", "prequel", "spin_off"]),
    narrativeOrder: z.number().int().optional(),
    isEssential: z.boolean().default(true),
    prerequisite: z.string().min(1).optional(),
});

export const franchiseFileSchema = z.object({
    name: z.string().min(1),
    franchise: z.string().min(1), // Franchise.id (AniList id of the root series)
    entries: z.array(entrySchema).min(1),
});

export type FranchiseSpec = z.infer<typeof franchiseFileSchema>;
export type ResolvedWork = { id: string; title: string };
export type ResolveWork = (ref: string) => Promise<ResolvedWork | null>;
export type StatusOf = (workIds: string[]) => Promise<Map<string, string>>;

const libraryStatuses: StatusOf = async (workIds) => {
    const entries = await prisma.libraryEntry.findMany({
        where: { accountId: DEFAULT_ACCOUNT, workId: { in: workIds } },
        select: { workId: true, status: true },
    });
    return new Map(entries.map((e) => [e.workId, e.status]));
};

/** A work id, or "<source>:<externalId>" for any ExternalId ("anilist:16498", "tmdb:tv:1429", "imdb:tt0944947"). */
export const resolveWorkRef: ResolveWork = async (ref) => {
    const byId = await prisma.work.findUnique({ where: { id: ref }, select: { id: true, title: true } });
    if (byId) return byId;
    const [source, ...rest] = ref.split(":");
    if (!rest.length) return null;
    const ext = await prisma.externalId.findUnique({
        where: { source_externalId: { source, externalId: rest.join(":") } },
        select: { work: { select: { id: true, title: true } } },
    });
    return ext?.work ?? null;
};

/**
 * Checks a spec against the library. Problems are fatal; warnings are not.
 * An explicit prerequisite always blocks its dependent, essential or not.
 */
export async function validateSpec(spec: FranchiseSpec, resolve: ResolveWork = resolveWorkRef, statusOf: StatusOf = libraryStatuses) {
    const problems: string[] = [];
    const warnings: string[] = [];
    const resolved = new Map<string, ResolvedWork>();

    const refs = new Set(spec.entries.flatMap((e) => [e.work, ...(e.prerequisite ? [e.prerequisite] : [])]));
    for (const ref of refs) {
        const work = await resolve(ref);
        if (work) resolved.set(ref, work);
        else problems.push(`unknown work "${ref}"`);
    }

    const byRef = new Map(spec.entries.map((e) => [e.work, e]));
    for (const e of spec.entries) {
        if (!e.prerequisite) continue;
        if (e.prerequisite === e.work) problems.push(`"${e.work}" cannot be its own prerequisite`);
        else if (!byRef.has(e.prerequisite)) problems.push(`prerequisite "${e.prerequisite}" is not an entry of this franchise`);
    }

    const inCycle = new Set<string>();
    for (const start of byRef.keys()) {
        if (inCycle.has(start)) continue;
        const path = new Set([start]);
        for (let cur = byRef.get(start)?.prerequisite; cur; cur = byRef.get(cur)?.prerequisite) {
            if (path.has(cur)) {
                // Report each cycle once, not once per member.
                const members = [...path].slice([...path].indexOf(cur));
                if (!members.some((m) => inCycle.has(m))) problems.push(`prerequisite cycle through "${cur}"`);
                members.forEach((m) => inCycle.add(m));
                break;
            }
            path.add(cur);
        }
    }

    const statuses = await statusOf([...resolved.values()].map((w) => w.id));
    const statusFor = (ref: string) => {
        const id = resolved.get(ref)?.id;
        return id ? statuses.get(id) : undefined;
    };

    for (const e of spec.entries) {
        const pre = e.prerequisite ? byRef.get(e.prerequisite) : undefined;
        if (!pre) continue;
        const preStatus = statusFor(pre.work);
        if (preStatus === "completed") {
            warnings.push(`prerequisite "${pre.work}" of "${e.work}" is already completed in your library; the dependency is redundant.`);
        } else if (preStatus === "dropped") {
            warnings.push(`prerequisite "${pre.work}" is dropped, so "${e.work}" stays blocked. Mark it completed, or remove the prerequisite.`);
        } else if (!pre.isEssential) {
            warnings.push(
                `"${pre.work}" is non-essential but is a prerequisite of "${e.work}". ` +
                    `"${e.work}" will not be next-up until "${pre.work}" is completed. ` +
                    `If you don't intend to watch it, remove the prerequisite; otherwise mark it isEssential: true.`
            );
        }
    }

    const byOrder = new Map<number, string[]>();
    for (const e of spec.entries) {
        if (e.narrativeOrder == null) continue;
        byOrder.set(e.narrativeOrder, [...(byOrder.get(e.narrativeOrder) ?? []), e.work]);
    }
    for (const [order, works] of byOrder) {
        if (works.length > 1) warnings.push(`narrativeOrder ${order} is shared by ${works.map((w) => `"${w}"`).join(", ")}; their relative order is arbitrary.`);
    }
    return { problems, warnings, resolved };
}

/** Writes the curated links. Throws on problems; returns warnings. */
export async function applySpec(spec: FranchiseSpec, resolve: ResolveWork = resolveWorkRef, statusOf: StatusOf = libraryStatuses) {
    const franchise = await prisma.franchise.findUnique({ where: { id: spec.franchise }, select: { id: true } });
    if (!franchise) throw new Error(`franchise ${spec.franchise} not found`);
    const { problems, warnings, resolved } = await validateSpec(spec, resolve, statusOf);
    if (problems.length) throw new Error(problems.join("\n  "));

    await prisma.$transaction(async (tx) => {
        // The YAML is the whole curated set for this franchise: curated links it no
        // longer lists are removed (the Work stays). Anything that depended on one is
        // either re-declared below or is being removed too, so nothing is silently unlocked.
        const keep = [];
        for (const e of spec.entries) {
            const link = await tx.franchiseLink.findUnique({
                where: { workId_franchiseId: { workId: resolved.get(e.work)!.id, franchiseId: spec.franchise } },
                select: { id: true },
            });
            if (link) keep.push(link.id);
        }
        await tx.franchiseLink.deleteMany({ where: { franchiseId: spec.franchise, curated: true, id: { notIn: keep } } });

        const linkIds = new Map<string, string>();
        for (const e of spec.entries) {
            const workId = resolved.get(e.work)!.id;
            const data = {
                relation: e.relation,
                narrativeOrder: e.narrativeOrder ?? null,
                isEssential: e.isEssential,
                curated: true,
                prerequisiteId: null,
            };
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
    return { warnings };
}
