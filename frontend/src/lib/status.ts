import type { MediaStatus, MediaType } from "../types";

export const STATUSES: MediaStatus[] = ["IN_PROGRESS", "PLANNED", "COMPLETED", "ON_HOLD", "DROPPED"];

/** One wording per medium: books are read, everything else is watched. */
export function statusLabel(status: string | null | undefined, mediaType?: MediaType): string {
  const book = mediaType === "BOOK";
  switch (status) {
    case "IN_PROGRESS":
      return book ? "Reading" : "Watching";
    case "PLANNED":
      return book ? "Want to read" : "Planned";
    case "COMPLETED":
      return book ? "Read" : "Completed";
    case "ON_HOLD":
      return "Paused";
    case "DROPPED":
      return "Dropped";
    default:
      return status ?? "";
  }
}
