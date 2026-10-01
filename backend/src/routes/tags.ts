import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { parseOrThrow } from "../utils/validate.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Personal tags ("comfort watch", "with family") and moods (KNOWN_ISSUES #66).
export const tagsRouter = Router();

const KIND = z.enum(["TAG", "MOOD"]);

tagsRouter.get("/", asyncHandler(async (_req, res) => {
    const tags = await prisma.tag.findMany({
        orderBy: [{ kind: "asc" }, { name: "asc" }],
        include: { _count: { select: { items: true } } },
    });
    res.json({ tags: tags.map(({ _count, ...t }) => ({ ...t, count: _count.items })) });
}));

tagsRouter.patch("/:id", asyncHandler(async (req, res) => {
    const data = parseOrThrow(
        z.object({ name: z.string().trim().min(1).max(40).optional(), kind: KIND.optional(), color: z.string().nullable().optional() }),
        req.body
    );
    const tag = await prisma.tag.update({ where: { id: req.params.id }, data });
    res.json({ tag });
}));

tagsRouter.delete("/:id", asyncHandler(async (req, res) => {
    await prisma.tag.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
}));

/**
 * Sets an item's tags of one kind by name, creating tags that don't exist yet.
 * Mounted on the library router as PUT /api/library/:id/tags.
 */
export const setItemTags = asyncHandler(async (req, res) => {
    const mediaId = req.params.id;
    const { names, kind } = parseOrThrow(
        z.object({ names: z.array(z.string().trim().min(1).max(40)).max(30), kind: KIND.default("TAG") }),
        req.body
    );
    // Case-insensitive de-duplication; the first spelling wins.
    const firstSpelling = new Map<string, string>();
    for (const n of names) if (!firstSpelling.has(n.toLowerCase())) firstSpelling.set(n.toLowerCase(), n);
    const unique = [...firstSpelling.values()];

    const existing = await prisma.tag.findMany();
    const byName = new Map(existing.map((t) => [t.name.toLowerCase(), t]));
    const tagIds: string[] = [];
    for (const name of unique) {
        const found = byName.get(name.toLowerCase());
        tagIds.push(found ? found.id : (await prisma.tag.create({ data: { name, kind } })).id);
    }

    const sameKind = existing.filter((t) => t.kind === kind).map((t) => t.id);
    await prisma.$transaction([
        prisma.mediaTag.deleteMany({ where: { mediaId, tagId: { in: sameKind } } }),
        prisma.mediaTag.createMany({ data: tagIds.map((tagId) => ({ mediaId, tagId })) }),
    ]);

    const tags = await prisma.mediaTag.findMany({ where: { mediaId }, include: { tag: true } });
    res.json({ tags: tags.map((t) => t.tag) });
});
