import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { parseOrThrow } from "../utils/validate.js";

export const listsRouter = Router();

listsRouter.get("/", async (_req, res) => {
    const lists = await prisma.customList.findMany({
        orderBy: { updatedAt: "desc" },
        include: { items: { include: { media: true }, orderBy: { order: "asc" } } }
    });
    res.json({ lists });
});

listsRouter.post("/", async (req, res) => {
    const data = parseOrThrow(z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        coverColor: z.string().optional()
    }), req.body);

    const list = await prisma.customList.create({ data });
    res.json({ list });
});

listsRouter.get("/:id", async (req, res) => {
    const list = await prisma.customList.findUnique({
        where: { id: req.params.id },
        include: { items: { include: { media: true }, orderBy: { order: "asc" } } }
    });
    if (!list) return res.status(404).json({ error: "Not found" });
    res.json({ list });
});

listsRouter.post("/:id/items", async (req, res) => {
    const data = parseOrThrow(z.object({
        mediaId: z.string().min(1)
    }), req.body);

    const count = await prisma.listItem.count({ where: { listId: req.params.id } });

    const item = await prisma.listItem.create({
        data: { listId: req.params.id, mediaId: data.mediaId, order: count }
    });
    res.json({ item });
});

listsRouter.delete("/:id/items/:itemId", async (req, res) => {
    await prisma.listItem.delete({ where: { id: req.params.itemId } });
    res.json({ ok: true });
});
