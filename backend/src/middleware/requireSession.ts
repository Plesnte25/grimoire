import type { Request, Response, NextFunction } from "express";
import { prisma } from "../db.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const requireSession = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const sessionId = req.cookies?.gr_session;
        if (!sessionId) {
            return res.status(401).json({ error: "Not authenticated", code: "UNAUTHENTICATED" });
        }

        const session = await prisma.session.findUnique({ where: { id: sessionId } });
        if (!session || session.expiresAt <= new Date()) {
            return res.status(401).json({ error: "Session expired", code: "SESSION_EXPIRED" });
        }

        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
        await prisma.session.update({ where: { id: sessionId }, data: { expiresAt } });
        res.cookie("gr_session", sessionId, {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            path: "/",
            expires: expiresAt,
        });
        next();
    }
);
