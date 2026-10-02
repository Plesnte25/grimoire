import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { parseOrThrow } from "../utils/validate.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { createHash, randomBytes } from "node:crypto";

export const listsRouter = Router();

const TOP10_MAX = 10;
const MEDIA_TYPES = ["MOVIE", "TV", "ANIME", "BOOK"] as const;
const withItems = { items: { include: { media: true }, orderBy: { order: "asc" as const } } };

function httpError(status: number, code: string, message: string) {
    const err: any = new Error(message);
    err.status = status;
    err.code = code;
    return err;
}

/** Re-numbers a list's items 0..n-1 in their current order. */
async function compact(listId: string) {
    const items = await prisma.listItem.findMany({ where: { listId }, orderBy: { order: "asc" } });
    await prisma.$transaction(items.map((it, i) => prisma.listItem.update({ where: { id: it.id }, data: { order: i } })));
}

// ?containing=<mediaId> adds `contains` per list (detail page: "already in this list").
listsRouter.get("/", asyncHandler(async (req, res) => {
    const containing = typeof req.query.containing === "string" ? req.query.containing : undefined;
    const lists = await prisma.customList.findMany({ orderBy: { updatedAt: "desc" }, include: withItems });
    res.json({
        lists: lists.map((l) => ({
            ...l,
            ...(containing ? { contains: l.items.some((it) => it.mediaId === containing) } : {}),
        })),
    });
}));

listsRouter.post("/", asyncHandler(async (req, res) => {
    const data = parseOrThrow(z.object({
        name: z.string().trim().min(1),
        description: z.string().optional(),
        coverColor: z.string().optional(),
        isRanked: z.boolean().optional(),
    }), req.body);

    const list = await prisma.customList.create({ data });
    res.json({ list });
}));

listsRouter.post("/:id/share", asyncHandler(async (req, res) => {
    const list = await prisma.customList.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!list) throw httpError(404, "NOT_FOUND", "List not found");
    const token = randomBytes(32).toString("hex");
    await prisma.customListShare.upsert({
        where: { listId: list.id },
        create: { listId: list.id, tokenHash: createHash("sha256").update(token).digest("hex") },
        update: { tokenHash: createHash("sha256").update(token).digest("hex"), createdAt: new Date() },
    });
    res.json({ token });
}));

listsRouter.delete("/:id/share", asyncHandler(async (req, res) => {
    const list = await prisma.customList.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!list) throw httpError(404, "NOT_FOUND", "List not found");
    await prisma.customListShare.deleteMany({ where: { listId: list.id } });
    res.json({ ok: true });
}));

// The Top 10 for a media type, created on first use.
listsRouter.get("/top10/:mediaType", asyncHandler(async (req, res) => {
    const { mediaType } = parseOrThrow(z.object({ mediaType: z.enum(MEDIA_TYPES) }), req.params);
    const existing = await prisma.customList.findFirst({ where: { kind: "TOP10", mediaType }, include: withItems });
    const list =
        existing ??
        (await prisma.customList.create({
            data: { kind: "TOP10", mediaType, isRanked: true, name: `Top 10` },
            include: withItems,
        }));
    res.json({ list });
}));

listsRouter.get("/:id", asyncHandler(async (req, res) => {
    const list = await prisma.customList.findUnique({ where: { id: req.params.id }, include: withItems });
    if (!list) return res.status(404).json({ error: "Not found" });
    res.json({ list });
}));

listsRouter.patch("/:id", asyncHandler(async (req, res) => {
    const data = parseOrThrow(z.object({
        name: z.string().trim().min(1).optional(),
        description: z.string().nullable().optional(),
        coverColor: z.string().nullable().optional(),
        isRanked: z.boolean().optional(),
    }), req.body);
    const list = await prisma.customList.update({ where: { id: req.params.id }, data, include: withItems });
    res.json({ list });
}));

listsRouter.delete("/:id", asyncHandler(async (req, res) => {
    await prisma.customList.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
}));

listsRouter.post("/:id/items", asyncHandler(async (req, res) => {
    const data = parseOrThrow(z.object({
        mediaId: z.string().min(1),
        note: z.string().optional(),
    }), req.body);

    const list = await prisma.customList.findUnique({ where: { id: req.params.id } });
    if (!list) throw httpError(404, "NOT_FOUND", "List not found");

    const existing = await prisma.listItem.findUnique({
        where: { listId_mediaId: { listId: list.id, mediaId: data.mediaId } },
    });
    if (existing) return res.json({ item: existing, alreadyInList: true });

    const count = await prisma.listItem.count({ where: { listId: list.id } });
    if (list.kind === "TOP10" && count >= TOP10_MAX) {
        throw httpError(409, "TOP10_FULL", "Your Top 10 is full. Remove one first.");
    }

    const item = await prisma.listItem.create({
        data: { listId: list.id, mediaId: data.mediaId, order: count, note: data.note },
    });
    await prisma.customList.update({ where: { id: list.id }, data: { updatedAt: new Date() } });
    res.json({ item, alreadyInList: false });
}));

listsRouter.patch("/:id/items/:itemId", asyncHandler(async (req, res) => {
    const data = parseOrThrow(z.object({ note: z.string().nullable() }), req.body);
    const item = await prisma.listItem.update({
        where: { id: req.params.itemId },
        data: { note: data.note?.trim() ? data.note.trim() : null },
    });
    res.json({ item });
}));

listsRouter.delete("/:id/items/:itemId", asyncHandler(async (req, res) => {
    await prisma.listItem.delete({ where: { id: req.params.itemId } });
    await compact(req.params.id);
    res.json({ ok: true });
}));

// Full new order: every item id of the list, first to last.
listsRouter.put("/:id/order", asyncHandler(async (req, res) => {
    const { itemIds } = parseOrThrow(z.object({ itemIds: z.array(z.string()).min(1) }), req.body);
    const items = await prisma.listItem.findMany({ where: { listId: req.params.id }, select: { id: true } });
    const known = new Set(items.map((i) => i.id));
    if (itemIds.length !== known.size || itemIds.some((id) => !known.has(id))) {
        throw httpError(400, "ORDER_MISMATCH", "itemIds must list every item of this list exactly once");
    }
    await prisma.$transaction(
        itemIds.map((id, order) => prisma.listItem.update({ where: { id }, data: { order } }))
    );
    const list = await prisma.customList.findUnique({ where: { id: req.params.id }, include: withItems });
    res.json({ list });
}));
