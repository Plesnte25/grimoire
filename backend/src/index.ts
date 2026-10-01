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
import { logsRouter } from "./routes/logs.js";
import { tierListsRouter } from "./routes/tierLists.js";
import { tagsRouter } from "./routes/tags.js";
import { catalogRouter } from "./routes/catalog.js";
import { providersRouter } from "./routes/providers.js";
import suggestionsRouter from "./routes/suggestions.js";
import { authRouter } from "./routes/auth.js";
import { requireSession } from "./middleware/requireSession.js";

const app = express();

// Behind Cloudflare Tunnel / a reverse proxy in production — trust its
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
                // Default helmet directive tells browsers to silently retry every
                // request over HTTPS on the same port. Harmless on the public
                // site (already HTTPS via Caddy), but it breaks plain-HTTP-only
                // access paths (e.g. a private Tailscale address with no TLS
                // cert) — browsers get a CSP-driven scheme upgrade that then
                // fails against a port that only speaks HTTP.
                "upgrade-insecure-requests": null,
            },
        },
        // Same reasoning as above, but worse: a browser caches this header
        // for `max-age` (180 days here) per-hostname and then forces HTTPS
        // on every future visit to that host, on any port, even after the
        // server stops sending the header. This app is reachable both over
        // public HTTPS (via Caddy) and over a plain-HTTP-only private
        // Tailscale address — sending HSTS unconditionally would permanently
        // break the private address the first time it's loaded. Send it only
        // when the request actually arrived over HTTPS.
        hsts: false,
    })
);
app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.secure) {
        res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
    }
    next();
});
app.use(
    cors({
        origin: process.env.FRONTEND_ORIGIN
            ? process.env.FRONTEND_ORIGIN.split(",")
            : true,
        credentials: true,
    })
);

app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());

app.get("/health", (_req: Request, res: Response) => res.json({ ok: true }));

app.use("/api/auth", authRouter);

app.use("/api/providers", requireSession, providersRouter);
app.use("/api/library", requireSession, libraryRouter);
app.use("/api/lists", requireSession, listsRouter);
app.use("/api/logs", requireSession, logsRouter);
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

const port = Number(process.env.PORT || 5050);
app.listen(port, () => console.log(`Backend running on http://localhost:${port}`));
