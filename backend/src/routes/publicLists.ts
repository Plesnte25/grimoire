import { createHash } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { parseOrThrow } from "../utils/validate.js";

export const publicListsRouter = Router();

publicListsRouter.get("/lists/:token", asyncHandler(async (req, res) => {
    const { token } = parseOrThrow(z.object({ token: z.string().regex(/^[0-9a-f]{64}$/) }), req.params);
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const share = await prisma.customListShare.findUnique({
        where: { tokenHash },
        select: { listId: true },
    });
    if (!share) return res.status(404).json({ error: "Shared list not found" });

    const list = await prisma.customList.findUnique({
        where: { id: share.listId },
        select: {
            name: true,
            description: true,
            coverColor: true,
            kind: true,
            mediaType: true,
            isRanked: true,
            items: {
                orderBy: { order: "asc" },
                select: {
                    order: true,
                    media: {
                        select: {
                            title: true,
                            mediaType: true,
                            year: true,
                            posterUrl: true,
                            globalRating: true,
                        },
                    },
                },
            },
        },
    });
    if (!list) return res.status(404).json({ error: "Shared list not found" });
    res.setHeader("Cache-Control", "no-store");
    res.json({ list });
}));
