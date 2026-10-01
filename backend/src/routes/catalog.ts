import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { collectionView, contributorView, franchiseView } from "../services/catalog.js";

export const catalogRouter = Router();

catalogRouter.get("/franchises/:id", asyncHandler(async (req, res) => {
    const view = await franchiseView(req.params.id);
    if (!view) return res.status(404).json({ error: "Not found" });
    res.json(view);
}));

catalogRouter.get("/collections/:id", asyncHandler(async (req, res) => {
    const view = await collectionView(req.params.id);
    if (!view) return res.status(404).json({ error: "Not found" });
    res.json(view);
}));

// Contributor ids contain a colon ("tmdb-person:525"); clients encode it.
catalogRouter.get("/contributors/:id", asyncHandler(async (req, res) => {
    const view = await contributorView(req.params.id);
    if (!view) return res.status(404).json({ error: "Not found" });
    res.json(view);
}));
