import type { Request, Response, NextFunction } from "express";
import { prisma } from "../db.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const requireSession = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const sessionId = req.cookies?.mv_session;
        if (!sessionId) {
            return res.status(401).json({ error: "Not authenticated", code: "UNAUTHENTICATED" });
        }

        const session = await prisma.session.findUnique({ where: { id: sessionId } });
        if (!session || session.expiresAt < new Date()) {
            return res.status(401).json({ error: "Session expired", code: "SESSION_EXPIRED" });
        }

        next();
    }
);
