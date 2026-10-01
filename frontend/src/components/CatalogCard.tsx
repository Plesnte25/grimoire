import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import type { CatalogEntry } from "../types";
import { addCatalogEntry } from "../app/api";
import { formatScore } from "../lib/ratings";
import { statusLabel } from "../lib/status";
import { showToast } from "../lib/toast";

/**
 * One entry on a franchise / collection / person page: yours (status, rating,
 * opens your item) or not yet (dimmed, with + Add).
 */
export function CatalogCard({ entry, subtitle, invalidate }: { entry: CatalogEntry; subtitle?: string | null; invalidate: unknown[] }) {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const mine = !!entry.libraryId;
  const upcoming = entry.status === "UPCOMING" || entry.status === "NOT_YET_RELEASED";

  const add = async () => {
    setAdding(true);
    try {
      const item = await addCatalogEntry(entry);
      showToast({ message: `Added "${entry.title}" as Planned`, actionLabel: "Open", onAction: () => nav(`/media/${item.id}`), timeoutMs: 6000 });
      qc.invalidateQueries({ queryKey: invalidate });
      qc.invalidateQueries({ queryKey: ["library"] });
    } catch (err: any) {
      showToast({ message: err?.response?.data?.error ?? "Couldn't add it", timeoutMs: 6000 });
    } finally {
      setAdding(false);
    }
  };

  return (
    <li className={`flex flex-col rounded-xl border p-2 ${mine ? "border-[#8b7ae0]/60 bg-[#8b7ae0]/10" : "border-white/10 bg-white/[0.03]"}`}>
      <button
        type="button"
        className={`aspect-[2/3] overflow-hidden rounded-lg bg-white/5 ${mine ? "" : "opacity-60"}`}
        onClick={() => (mine ? nav(`/media/${entry.libraryId}`) : add())}
        aria-label={mine ? `Open ${entry.title}` : `Add ${entry.title}`}
        disabled={adding}
      >
        {entry.posterUrl ? <img src={entry.posterUrl} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
      </button>
      <div className="mt-2 line-clamp-2 text-sm font-semibold">{entry.title}</div>
      <div className="text-xs text-white/75">
        {[subtitle, entry.year, upcoming ? "Upcoming" : null].filter(Boolean).join(" · ")}
      </div>
      <div className="mt-auto pt-2">
        {mine ? (
          <div className="text-xs text-white/90">
            {statusLabel(entry.yourStatus)}
            {entry.yourRating != null ? ` · You ${formatScore(entry.yourRating)}` : ""}
          </div>
        ) : (
          <button
            type="button"
            className="min-h-11 w-full rounded-lg bg-white/10 text-sm hover:bg-white/15 disabled:opacity-50"
            onClick={add}
            disabled={adding}
          >
            {adding ? "Adding…" : "+ Add"}
          </button>
        )}
      </div>
    </li>
  );
}

export const catalogGrid = "grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(140px,1fr))]";
