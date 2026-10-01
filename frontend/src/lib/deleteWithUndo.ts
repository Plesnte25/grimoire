import type { QueryClient } from "@tanstack/react-query";
import type { MediaItem } from "../types";
import { deleteLibraryItem } from "../app/api";
import { showToast } from "./toast";

const UNDO_MS = 10_000;

// Deletes that are confirmed but still inside their undo window. If the page is
// closed during the window the delete is sent anyway: the user did confirm it.
const pending = new Map<string, number>();

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => {
    for (const [id, timer] of pending) {
      window.clearTimeout(timer);
      fetch(`/api/library/${id}`, { method: "DELETE", credentials: "include", keepalive: true });
    }
    pending.clear();
  });
}

/**
 * Removes the item from every cached library view at once, then deletes it on
 * the server after the undo window unless "Undo" is pressed.
 */
export function deleteWithUndo(qc: QueryClient, item: Pick<MediaItem, "id" | "title">) {
  const snapshots = qc.getQueriesData({ queryKey: ["library"] });
  qc.setQueriesData({ queryKey: ["library"] }, (old: unknown) =>
    Array.isArray(old) ? old.filter((x: MediaItem) => x.id !== item.id) : old
  );

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["library"] });
    qc.invalidateQueries({ queryKey: ["lists"] });
    qc.invalidateQueries({ queryKey: ["suggestions"] });
  };

  const timer = window.setTimeout(async () => {
    pending.delete(item.id);
    try {
      await deleteLibraryItem(item.id);
    } catch {
      showToast({ message: `Couldn't remove "${item.title}". It's back in your library.`, timeoutMs: 6000 });
    } finally {
      refresh();
    }
  }, UNDO_MS);
  pending.set(item.id, timer);

  showToast({
    message: `Removed "${item.title}"`,
    actionLabel: "Undo",
    timeoutMs: UNDO_MS,
    onAction: () => {
      window.clearTimeout(timer);
      pending.delete(item.id);
      for (const [key, data] of snapshots) qc.setQueryData(key, data);
      refresh();
    },
  });
}
