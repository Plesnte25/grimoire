import { createRequire } from "module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Request, Response, NextFunction } from "express";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

import helmet from "helmet";

import { libraryRouter } from "./routes/library.js";
import { listsRouter } from "./routes/lists.js";
import { tierListsRouter } from "./routes/tierLists.js";
import { tagsRouter } from "./routes/tags.js";
import { catalogRouter } from "./routes/catalog.js";
import { providersRouter } from "./routes/providers.js";
import suggestionsRouter from "./routes/suggestions.js";
import { authRouter } from "./routes/auth.js";
import { homeRouter } from "./routes/home.js";
import { backupRouter } from "./routes/backup.js";
import { statsRouter } from "./routes/stats.js";
import { publicListsRouter } from "./routes/publicLists.js";
import { requireSession } from "./middleware/requireSession.js";
import { prisma } from "./db.js";
import { startJobWorker } from "./services/jobs.js";
import { providerHealthSnapshot } from "./services/providerHealth.js";

const app = express();

// Behind Caddy in production — trust its
// X-Forwarded-For so express-rate-limit can identify clients correctly.
app.set("trust proxy", 1);

// Posters/artwork come from several third-party CDNs (TMDB, Google Books,
// AniList) whose exact subdomains vary — allow any https image
// rather than enumerating hosts. Only matters once Express itself serves the
// page (production); Vite's dev server carries no CSP, so this never showed
// up locally.
app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                ...helmet.contentSecurityPolicy.getDefaultDirectives(),
                "img-src": ["'self'", "data:", "https:"],
            },
        },
    })
);
app.use(
    cors({
        origin: process.env.FRONTEND_ORIGIN
            ? process.env.FRONTEND_ORIGIN.split(",")
            : true,
        credentials: true,
    })
);

app.use(cookieParser());
app.use("/api/backup", requireSession, express.json({ limit: "20mb" }), backupRouter);
app.use(express.json({ limit: "2mb" }));

app.get("/health", async (_req: Request, res: Response) => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        res.json({ ok: true });
    } catch (err) {
        console.error("Health check: database unavailable:", err);
        res.status(503).json({ ok: false, error: "database unavailable" });
    }
});

app.get("/health/providers", requireSession, (_req: Request, res: Response) => res.json(providerHealthSnapshot()));

app.use("/api/auth", authRouter);
app.use("/api/public", publicListsRouter);

app.use("/api/home", requireSession, homeRouter);
app.use("/api/stats", requireSession, statsRouter);
app.use("/api/providers", requireSession, providersRouter);
app.use("/api/library", requireSession, libraryRouter);
app.use("/api/lists", requireSession, listsRouter);
app.use("/api/tier-lists", requireSession, tierListsRouter);
app.use("/api/tags", requireSession, tagsRouter);
app.use("/api/suggestions", requireSession, suggestionsRouter);
app.use("/api", requireSession, catalogRouter);

// Serve the built frontend in production — makes the deployed app single-origin
// (no CORS, no cross-origin cookie concerns) since one Node process serves both.
const frontendDist = path.join(__dirname, "../../frontend/dist");
app.use(express.static(frontendDist));
app.get(/^(?!\/api|\/health).*/, (_req: Request, res: Response) => {
    res.sendFile(path.join(frontendDist, "index.html"));
});

/**
 * ✅ Central error handler (prevents crashes from thrown errors in routes)
 */
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err?.status ?? 500;
    const payload = {
        error: err?.message ?? "Internal Server Error",
        code: err?.code ?? "INTERNAL_ERROR",
    };

    console.error("API Error:", err);
    res.status(status).json(payload);
});

/**
 * ✅ Dev safety: keep server alive & log root causes
 */
process.on("unhandledRejection", (reason) => {
    console.error("UNHANDLED_REJECTION:", reason);
});
process.on("uncaughtException", (err) => {
    console.error("UNCAUGHT_EXCEPTION:", err);
});

// Loopback only: Caddy on the same box is the sole public entry point, so the
// app is never reachable directly on its own port, whatever the firewall says.
const port = Number(process.env.PORT || 5050);
const host = process.env.HOST || "127.0.0.1";
app.listen(port, host, () => console.log(`Backend running on http://${host}:${port}`));
startJobWorker();
