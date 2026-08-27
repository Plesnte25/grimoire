import { createRequire } from "module";
import type { Request, Response, NextFunction } from "express";

const require = createRequire(import.meta.url);
const express = require("express");
const cors = require("cors");

import helmet from "helmet";

import { libraryRouter } from "./routes/library.js";
import { listsRouter } from "./routes/lists.js";
import { providersRouter } from "./routes/providers.js";
import suggestionsRouter from "./routes/suggestions.js";

const app = express();

app.use(helmet());
app.use(
    cors({
        origin: true,
        credentials: true,
    })
);

app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req: Request, res: Response) => res.json({ ok: true }));

app.use("/api/providers", providersRouter);
app.use("/api/library", libraryRouter);
app.use("/api/lists", listsRouter);
app.use("/api/suggestions", suggestionsRouter);

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
