import { useNavigate } from "react-router-dom";
import type { MediaItem } from "../types";
import { statusLabel } from "../lib/status";

const ROLE_WORDS: Record<string, [string, string]> = {
  MAIN: ["season", "seasons"],
  MOVIE: ["movie", "movies"],
  OVA: ["OVA", "OVAs"],
  ONA: ["ONA", "ONAs"],
  SPECIAL: ["special", "specials"],
};

/** "5 seasons · 2 movies" from the tracked entries' franchise roles. */
function roleSummary(items: MediaItem[]) {
  const counts = new Map<string, number>();
  for (const it of items) counts.set(it.franchiseRole ?? "MAIN", (counts.get(it.franchiseRole ?? "MAIN") ?? 0) + 1);
  return ["MAIN", "MOVIE", "OVA", "ONA", "SPECIAL"]
    .filter((r) => counts.get(r))
    .map((r) => `${counts.get(r)} ${ROLE_WORDS[r][counts.get(r) === 1 ? 0 : 1]}`)
    .join(" · ");
}

/** The status shown for a group: anything in progress wins, then the most common. */
function groupStatus(items: MediaItem[]) {
  if (items.some((i) => i.status === "IN_PROGRESS")) return "IN_PROGRESS";
  if (items.every((i) => i.status === "COMPLETED")) return "COMPLETED";
  if (items.some((i) => i.status === "ON_HOLD")) return "ON_HOLD";
  return items[0]?.status;
}

/** One tile for an anime franchise or a movie collection; opens its page. */
export function GroupTile({ items, name, kind }: { items: MediaItem[]; name?: string | null; kind: "franchise" | "collection" }) {
  const nav = useNavigate();
  const first = items[0];
  const poster = kind === "franchise" ? first.franchise?.posterUrl ?? first.posterUrl : first.posterUrl;
  const title = name ?? first.title;
  const summary = kind === "franchise" ? roleSummary(items) : `${items.length} films`;
  const newEpisodes = items
    .filter((item) => item.status !== "DROPPED")
    .reduce((count, item) => count + Math.max(0, (item.airedEpisodeCount ?? 0) - (item.progressValue ?? 0)), 0);
  const announced = items.find((item) => item.announcedNext || item.nextAirDate);
  const airingSummary = newEpisodes
    ? `${newEpisodes} new episode${newEpisodes === 1 ? "" : "s"}`
    : announced?.announcedNext
      ? announced.announcedNext
      : announced?.nextAirDate
        ? `Next · ${new Date(announced.nextAirDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
        : null;
  const href = kind === "franchise" ? `/franchise/${first.franchiseId}` : `/collection/${first.collectionId}`;
  const status = statusLabel(groupStatus(items), first.mediaType);

  return (
    <button
      type="button"
      onClick={() => nav(href)}
      aria-label={`${title}: ${summary}, ${status}`}
      className="group relative text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white rounded-xl"
    >
      {/* Two offset sheets behind the poster say "more inside". */}
      <div className="relative aspect-[2/3]">
        <div className="absolute inset-0 translate-x-1.5 -translate-y-1.5 rounded-xl bg-white/10" aria-hidden="true" />
        <div className="absolute inset-0 translate-x-0.5 -translate-y-0.5 rounded-xl bg-white/15" aria-hidden="true" />
        <div className="absolute inset-0 overflow-hidden rounded-xl border border-white/15 bg-white/5">
          {poster ? <img src={poster} alt="" loading="lazy" className="h-full w-full object-cover transition group-hover:scale-[1.03]" /> : null}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-2.5 pt-10">
            <div className="line-clamp-2 text-sm font-semibold">{title}</div>
            <div className="text-xs text-white/85">{summary}{airingSummary ? ` · ${airingSummary}` : ""}</div>
          </div>
          <div className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[11px]">{status}</div>
        </div>
      </div>
    </button>
  );
}
