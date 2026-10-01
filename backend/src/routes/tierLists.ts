import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { parseOrThrow } from "../utils/validate.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Tier lists (KNOWN_ISSUES #67): items placed in S / A / B / C / D rows.
export const tierListsRouter = Router();

export const TIERS = ["S", "A", "B", "C", "D"] as const;
const withEntries = {
    entries: { include: { media: true }, orderBy: [{ tier: "asc" as const }, { order: "asc" as const }] },
};

tierListsRouter.get("/", asyncHandler(async (_req, res) => {
    const tierLists = await prisma.tierList.findMany({ orderBy: { updatedAt: "desc" }, include: withEntries });
    res.json({ tierLists });
}));

tierListsRouter.post("/", asyncHandler(async (req, res) => {
    const data = parseOrThrow(
        z.object({ name: z.string().trim().min(1), description: z.string().optional() }),
        req.body
    );
    const tierList = await prisma.tierList.create({ data, include: withEntries });
    res.json({ tierList });
}));

tierListsRouter.get("/:id", asyncHandler(async (req, res) => {
    const tierList = await prisma.tierList.findUnique({ where: { id: req.params.id }, include: withEntries });
    if (!tierList) return res.status(404).json({ error: "Not found" });
    res.json({ tierList });
}));

tierListsRouter.patch("/:id", asyncHandler(async (req, res) => {
    const data = parseOrThrow(
        z.object({ name: z.string().trim().min(1).optional(), description: z.string().nullable().optional() }),
        req.body
    );
    const tierList = await prisma.tierList.update({ where: { id: req.params.id }, data, include: withEntries });
    res.json({ tierList });
}));

tierListsRouter.delete("/:id", asyncHandler(async (req, res) => {
    await prisma.tierList.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
}));

// Replaces the whole placement: what the drag-and-drop editor saves.
tierListsRouter.put("/:id/entries", asyncHandler(async (req, res) => {
    const { entries } = parseOrThrow(
        z.object({
            entries: z.array(z.object({ mediaId: z.string().min(1), tier: z.enum(TIERS) })),
        }),
        req.body
    );
    const ids = entries.map((e) => e.mediaId);
    if (new Set(ids).size !== ids.length) {
        const err: any = new Error("An item can only be in one tier");
        err.status = 400;
        err.code = "DUPLICATE_ENTRY";
        throw err;
    }
    const orderInTier = new Map<string, number>();
    await prisma.$transaction([
        prisma.tierEntry.deleteMany({ where: { tierListId: req.params.id } }),
        prisma.tierEntry.createMany({
            data: entries.map((e) => {
                const order = orderInTier.get(e.tier) ?? 0;
                orderInTier.set(e.tier, order + 1);
                return { tierListId: req.params.id, mediaId: e.mediaId, tier: e.tier, order };
            }),
        }),
        prisma.tierList.update({ where: { id: req.params.id }, data: { updatedAt: new Date() } }),
    ]);
    const tierList = await prisma.tierList.findUnique({ where: { id: req.params.id }, include: withEntries });
    res.json({ tierList });
}));
