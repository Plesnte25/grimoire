import type { MediaItem } from "@prisma/client";

/** Total units for an item's progress: episodes, aired episodes, or pages. */
export function progressTotal(item: MediaItem): number | null {
    if (item.progressTotalOverride != null) return item.progressTotalOverride;
    if (item.mediaType === "BOOK") return item.pageCount ?? null;
    if (item.mediaType === "ANIME" || item.mediaType === "TV") {
        // Ongoing series have no final count; aired-so-far is the useful total.
        return item.episodes ?? item.airedEpisodeCount ?? null;
    }
    return null; // movies: progress is the watch log (rewatches), not a counter
}

/** A series that can't get new episodes, so reaching the total means done. */
export function isFinished(item: MediaItem): boolean {
    if (item.mediaType === "BOOK" || item.mediaType === "MOVIE") return true;
    return item.airStatus === "ENDED" || item.airStatus === "CANCELED";
}
