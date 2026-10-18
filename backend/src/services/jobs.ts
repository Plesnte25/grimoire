import { z } from "zod";
import { prisma } from "../db.js";
import { enrichItem } from "./enrich.js";
import { refreshDueMetadata } from "./dailyRefresh.js";
import { reconcileWorks, workDrift } from "./works.js";

export type JobType = "enrich-item" | "daily-refresh";

const POLL_MS = 5_000;
const MAX_ATTEMPTS = 5;
const LEASE_MS = 10 * 60 * 1000;

const payloadSchemas = {
    "enrich-item": z.object({ mediaId: z.string().min(1) }),
    "daily-refresh": z.object({}).passthrough(),
} satisfies Record<JobType, z.ZodTypeAny>;

class PermanentJobError extends Error {}

const ACTIVE = ["pending", "running"];

export async function enqueueJob(type: JobType, payload: unknown = {}, runAfter = new Date()) {
    return prisma.job.create({ data: { type, payload: JSON.stringify(payload), runAfter } });
}

/** Queues enrichment for an item unless a pending or running job already covers it. */
export async function enqueueEnrichment(mediaId: string) {
    const payload = JSON.stringify({ mediaId });
    const existing = await prisma.job.findFirst({
        where: { type: "enrich-item", payload, status: { in: ACTIVE } },
    });
    if (existing) return existing;
    // A parked job for this item is superseded by the fresh one.
    return prisma.job.create({ data: { type: "enrich-item", payload } });
}

export function nextDailyRun(now = new Date()) {
    const next = new Date(now);
    next.setHours(4, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next;
}

/** daily-refresh is a single recurring row that is rescheduled, never deleted. */
async function ensureDailyRefreshQueued() {
    const existing = await prisma.job.findFirst({ where: { type: "daily-refresh" }, select: { id: true } });
    if (!existing) await enqueueJob("daily-refresh", {}, nextDailyRun());
}

async function runJob(job: { type: string; payload: string }) {
    const schema = payloadSchemas[job.type as JobType];
    if (!schema) throw new PermanentJobError(`Unknown job type: ${job.type}`);

    let raw: unknown;
    try {
        raw = JSON.parse(job.payload || "{}");
    } catch {
        throw new PermanentJobError("Malformed job payload");
    }
    const parsed = schema.safeParse(raw);
    if (!parsed.success) throw new PermanentJobError(`Invalid job payload: ${parsed.error.message}`);

    switch (job.type as JobType) {
        case "enrich-item": {
            const { mediaId } = parsed.data as { mediaId: string };
            const result = await enrichItem(mediaId);
            if (!result.ok) throw new Error(result.error ?? "enrichment failed");
            return;
        }
        case "daily-refresh":
            await refreshDueMetadata();
            // Safety net for the Phase 2 dual-write; must not fail the refresh itself.
            await reconcileWorks()
                .then((r) => r.failed.length && console.error(`Work reconcile: ${r.failed.length} items failed`))
                .catch((err) => console.error("Work reconcile failed:", err));
            const drift = await workDrift().catch(() => null);
            const bad = drift ? Object.entries(drift).filter(([, n]) => n > 0) : [];
            if (bad.length) console.error("Work drift after reconcile:", Object.fromEntries(bad));
            return;
    }
}

/** Atomically moves the next due job (or one whose lease expired) to running. */
async function claimNext() {
    const now = new Date();
    const due = {
        OR: [
            { status: "pending", runAfter: { lte: now } },
            { status: "running", claimedAt: { lt: new Date(now.getTime() - LEASE_MS) } },
        ],
    };
    const candidate = await prisma.job.findFirst({ where: due, orderBy: { runAfter: "asc" } });
    if (!candidate) return null;
    const claimed = await prisma.job.updateMany({
        where: { id: candidate.id, status: candidate.status, claimedAt: candidate.claimedAt, ...(candidate.status === "pending" ? { runAfter: { lte: now } } : {}) },
        data: { status: "running", claimedAt: now, attempts: { increment: 1 } },
    });
    return claimed.count === 1 ? { ...candidate, attempts: candidate.attempts + 1 } : null;
}

async function processOne(): Promise<boolean> {
    const job = await claimNext();
    if (!job) return false;
    const recurring = job.type === "daily-refresh";
    try {
        await runJob(job);
        if (recurring) {
            await prisma.job.update({
                where: { id: job.id },
                data: { status: "pending", runAfter: nextDailyRun(), claimedAt: null, attempts: 0, lastError: null },
            });
        } else {
            await prisma.job.delete({ where: { id: job.id } });
        }
    } catch (err: any) {
        const message = String(err?.message ?? err).slice(0, 500);
        console.error(`Job ${job.type} (${job.id}) failed (attempt ${job.attempts}):`, message);
        if (recurring) {
            await prisma.job.update({
                where: { id: job.id },
                data: { status: "pending", runAfter: nextDailyRun(), claimedAt: null, attempts: 0, lastError: message },
            });
        } else if (err instanceof PermanentJobError || job.attempts >= MAX_ATTEMPTS) {
            await prisma.job.update({ where: { id: job.id }, data: { status: "parked", claimedAt: null, lastError: message } });
        } else {
            const backoff = Math.min(60 * 60 * 1000, 30_000 * 2 ** (job.attempts - 1));
            await prisma.job.update({
                where: { id: job.id },
                data: { status: "pending", claimedAt: null, runAfter: new Date(Date.now() + backoff), lastError: message },
            });
        }
    }
    return true;
}

export function startJobWorker() {
    let busy = false;
    const timer = setInterval(async () => {
        if (busy) return;
        busy = true;
        try {
            await ensureDailyRefreshQueued();
            while (await processOne());
        } catch (err) {
            console.error("Job worker error:", err);
        } finally {
            busy = false;
        }
    }, POLL_MS);
    timer.unref();
}
