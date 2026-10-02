import type { MediaItem } from "../types";
import { formatScore, onlineRating, onlineRatingText, personalRating } from "../lib/ratings";
import { statusLabel } from "../lib/status";
import { countryName } from "../lib/regions";
import { CountryFlag } from "./CountryFlag";

type Variant = "tile" | "row";

export function safeParseGenres(genres: unknown): string[] {
  if (Array.isArray(genres)) {
    return genres.map((genre) => {
      if (typeof genre === "string") return genre;
      if (genre && typeof genre === "object" && "name" in genre) return String(genre.name);
      return String(genre ?? "");
    }).map((genre) => genre.trim()).filter(Boolean);
  }
  if (typeof genres !== "string" || !genres.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(genres);
    if (Array.isArray(parsed)) return safeParseGenres(parsed);
  } catch {
    return genres.split(",").map((genre) => genre.trim()).filter(Boolean);
  }
  return [genres.trim()];
}

function ratingText(item: MediaItem) {
  const mine = personalRating(item);
  const online = onlineRating(item);
  const parts: string[] = [];
  if (mine != null) parts.push(`✦ ${formatScore(mine)}`);
  if (online && !online.lowConfidence) parts.push(onlineRatingText(online));
  return parts.join(" · ");
}

function titleMeta(item: MediaItem) {
  const parts = [item.year ? String(item.year) : null, item.countryOfOrigin ? countryName(item.countryOfOrigin) : null]
    .filter(Boolean);
  return parts.join(" · ");
}

function airingLabel(item: MediaItem): string | null {
  if (item.status === "IN_PROGRESS" && item.mediaType !== "MOVIE" && item.mediaType !== "BOOK") {
    const aired = item.airedEpisodeCount ?? item.episodes ?? 0;
    const unseen = Math.max(0, aired - (item.progressValue ?? 0));
    if (unseen) return `${unseen} new episode${unseen === 1 ? "" : "s"}`;
  }
  if (item.nextAirDate && new Date(item.nextAirDate) > new Date()) {
    return `Next episode ${new Date(item.nextAirDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  }
  if (item.announcedNext) return item.announcedNext;
  if (item.airStatus === "RETURNING") return "Returning";
  return null;
}

export function MediaCard({
  item,
  onOpen,
  variant = "row",
}: {
  item: MediaItem;
  onOpen?: () => void;
  variant?: Variant;
  onQuickAdd?: (item: MediaItem) => void;
  onToggleWatched?: (item: MediaItem) => void;
  onToggleLike?: (item: MediaItem) => void;
}) {
  const mine = personalRating(item);
  const online = onlineRating(item);
  if (variant === "tile") {
    return (
      <button type="button" onClick={onOpen} className="group min-w-0 text-left focus-visible:outline">
        <div className="relative aspect-[2/3] overflow-hidden rounded-[var(--radius-poster)] bg-[var(--s2)]">
          {item.posterUrl ? (
            <img src={item.posterUrl} alt="" className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]" loading="lazy" draggable={false} />
          ) : item.backdropUrl ? (
            <img src={item.backdropUrl} alt="" className="h-full w-full object-cover" loading="lazy" draggable={false} />
          ) : (
            <div className="grid h-full place-items-center px-2 text-center text-xs text-[var(--tx3)]">No cover</div>
          )}
          {item.countryOfOrigin ? (
            <span className="absolute right-2 top-2 rounded bg-[var(--bg)] px-1.5 py-1 text-sm leading-none" title={countryName(item.countryOfOrigin)}>
              <CountryFlag code={item.countryOfOrigin} />
            </span>
          ) : null}
          <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 pb-2 pt-8">
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="rounded bg-[var(--bg)] px-1.5 py-1 text-[10px] font-semibold leading-none text-[var(--tx)]">
                {statusLabel(item.status, item.mediaType)}
              </span>
              {personalRating(item) != null ? (
                <span className="rounded bg-[var(--youbg)] px-1.5 py-1 text-[10px] font-semibold leading-none text-[var(--you)]">✦ {formatScore(personalRating(item)!)}</span>
              ) : null}
              {airingLabel(item) ? (
                <span className="rounded bg-[var(--accbg)] px-1.5 py-1 text-[10px] font-semibold leading-none text-[var(--acc-ink)]">{airingLabel(item)}</span>
              ) : null}
            </span>
          </span>
        </div>
        <span className="mt-2 block line-clamp-2 text-sm font-semibold leading-snug text-[var(--tx)]">{item.title}</span>
        {item.nativeTitle && item.nativeTitle !== item.title ? (
          <span className="mt-0.5 block truncate text-xs text-[var(--tx3)]" lang={item.originalLanguage ?? undefined} dir={item.originalLanguage === "ur" ? "rtl" : undefined}>{item.nativeTitle}</span>
        ) : null}
        <span className="mt-1 block truncate text-xs text-[var(--tx3)]">
          {[titleMeta(item), ratingText(item)].filter(Boolean).join(" · ")}
        </span>
      </button>
    );
  }

  return (
    <button type="button" onClick={onOpen} className="surface-card flex min-h-[6.5rem] w-full items-center gap-3 rounded-[var(--radius-card)] p-3 text-left transition-colors hover:bg-[var(--s2)]">
      <div className="h-20 w-14 shrink-0 overflow-hidden rounded-md bg-[var(--s2)]">
        {item.posterUrl ? <img src={item.posterUrl} alt="" className="h-full w-full object-cover" loading="lazy" /> : null}
      </div>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-[var(--tx)]">{item.title}</span>
        {item.nativeTitle && item.nativeTitle !== item.title ? <span className="mt-0.5 block truncate text-xs text-[var(--tx3)]" lang={item.originalLanguage ?? undefined} dir={item.originalLanguage === "ur" ? "rtl" : undefined}>{item.nativeTitle}</span> : null}
        <span className="mt-1 block text-xs text-[var(--tx3)]">{titleMeta(item)}{titleMeta(item) ? " · " : ""}{statusLabel(item.status, item.mediaType)}</span>
        {item.progressText ? <span className="mt-1 block text-xs tabular-nums text-[var(--tx2)]">{item.progressText}</span> : null}
        {airingLabel(item) ? <span className="mt-1 block text-xs font-medium text-[var(--acc)]">{airingLabel(item)}</span> : null}
      </span>
      <span className="max-w-[32%] shrink-0 truncate text-xs tabular-nums">
        {mine != null ? (
          <span className="text-[var(--you)]" aria-label={`Your rating ${formatScore(mine)}`}>
            ✦ {formatScore(mine)}
          </span>
        ) : null}
        {online && !online.lowConfidence ? (
          <span className="ml-2 text-[var(--tx3)]" aria-label={onlineRatingText(online)}>
            {onlineRatingText(online)}
          </span>
        ) : null}
      </span>
    </button>
  );
}
