import { useNavigate } from "react-router-dom";
import type { CatalogEntry, ProviderSearchResult } from "../types";
import { formatScore } from "../lib/ratings";
import { statusLabel } from "../lib/status";
import { useAppSearch } from "./AppShell";

/**
 * One entry on a franchise / collection / person page: yours (status, rating,
 * opens your item) or not yet (dimmed, with + Add).
 */
export function CatalogCard({ entry, subtitle }: { entry: CatalogEntry; subtitle?: string | null }) {
  const nav = useNavigate();
  const { openSearch } = useAppSearch();
  const mine = !!entry.libraryId;
  const upcoming = entry.status === "UPCOMING" || entry.status === "NOT_YET_RELEASED";
  const newEpisodes = mine && entry.yourStatus !== "DROPPED"
    ? Math.max(0, (entry.airedEpisodeCount ?? 0) - (entry.progressValue ?? 0))
    : 0;
  const airLabel = newEpisodes
    ? `${newEpisodes} new episode${newEpisodes === 1 ? "" : "s"}`
    : entry.announcedNext
      ? `${entry.announcedNext}${entry.announcedNextDate ? ` · ${new Date(entry.announcedNextDate).toLocaleDateString(undefined, { month: "short", year: "numeric" })}` : ""}`
      : entry.nextAirEpisode && entry.nextAirDate
        ? `Ep ${entry.nextAirEpisode} · ${new Date(entry.nextAirDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
        : null;

  const add = () => {
    const initialItem: ProviderSearchResult = {
      provider: entry.provider,
      providerId: entry.providerId,
      mediaType: entry.mediaType,
      title: entry.title,
      year: entry.year ?? undefined,
      posterUrl: entry.posterUrl ?? undefined,
    };
    openSearch({ initialItem });
  };

  return (
    <li className={`flex flex-col rounded-xl border p-2 ${mine ? "border-[var(--acc)]/60 bg-[var(--acc)]/10" : "border-[var(--line)] bg-[var(--s1)]"}`}>
      <button
        type="button"
        className={`aspect-[2/3] overflow-hidden rounded-lg bg-[var(--s2)] ${mine ? "" : "opacity-80"}`}
        onClick={() => (mine ? nav(`/media/${entry.libraryId}`) : add())}
        aria-label={mine ? `Open ${entry.title}` : `Add ${entry.title}`}
      >
        {entry.posterUrl ? <img src={entry.posterUrl} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
      </button>
      <div className="mt-2 line-clamp-2 text-sm font-semibold">{entry.title}</div>
      <div className="text-xs text-white/75">
        {[subtitle, entry.year, upcoming ? "Upcoming" : null].filter(Boolean).join(" · ")}
      </div>
      {airLabel ? <div className="mt-1 text-xs font-medium text-[var(--acc)]">{airLabel}</div> : null}
      <div className="mt-auto pt-2">
        {mine ? (
          <div className="text-xs text-white/90">
            {statusLabel(entry.yourStatus)}
            {entry.yourRating != null ? ` · You ${formatScore(entry.yourRating)}` : ""}
          </div>
        ) : (
          <button
            type="button"
            className="min-h-11 w-full rounded-lg bg-[var(--s2)] text-sm hover:bg-[var(--s3)] disabled:opacity-50"
            onClick={add}
          >
            + Add
          </button>
        )}
      </div>
    </li>
  );
}

export const catalogGrid = "grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8";
