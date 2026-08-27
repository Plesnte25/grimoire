import type { MediaItem } from "../types";

type Variant = "tile" | "row";

export function safeParseGenres(genres: any): string[] {
  if (!genres) return [];

  if (Array.isArray(genres)) {
    return genres
      .map((g) => {
        if (!g) return null;
        if (typeof g === "string") return g;
        if (typeof g === "object" && "name" in g)
          return String((g as any).name);
        return String(g);
      })
      .map((s) => (s ?? "").trim())
      .filter(Boolean);
  }

  if (typeof genres === "string") {
    const s = genres.trim();
    if (!s) return [];
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return safeParseGenres(parsed);
    } catch {
      // fallthrough
    }
    if (s.includes(",")) {
      return s
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
    }
    return [s];
  }

  return [];
}

function prettyStatus(status?: string) {
  if (!status) return "";
  if (status === "IN_PROGRESS") return "Ongoing";
  if (status === "PLANNING") return "Planning";
  if (status === "COMPLETED") return "Completed";
  if (status === "ON_HOLD") return "On Hold";
  if (status === "DROPPED") return "Dropped";
  return status;
}

function ratingText(item: any) {
  const r = item?.yourRating ?? item?.globalRating;
  if (typeof r !== "number") return null;
  const label =
    item?.yourRating != null ? "You" : item?.globalRatingText ?? "TMDB";
  return `★ ${r.toFixed(1)} (${label})`;
}

function durationText(item: any) {
  const t =
    (item as any)?.durationText ??
    (item as any)?.runtimeText ??
    (item as any)?.runtime ??
    null;

  if (typeof t === "string" && t.trim()) return t.trim();

  const mins =
    (item as any)?.runtimeMinutes ?? (item as any)?.runtimeMins ?? null;
  if (typeof mins === "number" && mins > 0) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  const p = (item as any)?.progressText;
  if (typeof p === "string" && p.trim()) return p.trim();

  return null;
}

export function MediaCard({
  item,
  onOpen,
  onDelete,
  variant = "row",
}: {
  item: MediaItem;
  onOpen?: () => void;
  onDelete?: (id: string) => void;
  variant?: Variant;
  onQuickAdd?: (item: MediaItem) => void;
  onToggleWatched?: (item: MediaItem) => void;
  onToggleLike?: (item: MediaItem) => void;
}) {
  const genres = safeParseGenres((item as any).genres);
  const year = (item as any).year ?? "";
  const status = (item as any).status ?? "";
  const dur = durationText(item);
  const rating = ratingText(item);

  if (variant === "tile") {
    const statusLabel =
      status === "IN_PROGRESS"
        ? "Watching"
        : status === "PLANNED"
        ? "Planning"
        : status === "ON_HOLD"
        ? "Paused"
        : status === "COMPLETED"
        ? "Completed"
        : status === "DROPPED"
        ? "Dropped"
        : "";

    const metaGenres = genres.slice(0, 3).join(" · ");
    const metaYear = year ? String(year) : "";
    const metaRating = ratingText(item);

    return (
      <button
        onClick={onOpen}
        className="
          group relative shrink-0 text-left
          w-[120px] sm:w-[140px] md:w-[170px] lg:w-[190px] xl:w-[210px]
          focus:outline-none
        "
        title={item.title}
        aria-label={item.title}
      >
        {/* Whole card scales (not just image) */}
        <div
          className="
            relative rounded-lg overflow-hidden
            border border-white/10 bg-white/5
            transform-gpu transition duration-200
            group-hover:scale-[1.14] group-hover:z-30 group-hover:shadow-2xl
          "
        >
          {/* Poster */}
          <div className="relative w-full aspect-[2/3] bg-black/30">
            {item.posterUrl ? (
              <img
                src={item.posterUrl}
                alt={item.title}
                className="h-full w-full object-cover"
                loading="lazy"
                draggable={false}
              />
            ) : item.backdropUrl ? (
              <img
                src={item.backdropUrl}
                alt={item.title}
                className="h-full w-full object-cover"
                loading="lazy"
                draggable={false}
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-xs opacity-60">
                No image
              </div>
            )}

            {/* subtle dark gradient */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-60" />
          </div>

          {/* ✕ Delete (shows on hover) */}
          {onDelete ? (
            <button
              className="
      absolute top-2 right-2 z-20
      h-7 w-7 rounded-full
      bg-black/50 backdrop-blur-md border border-white/15
      flex items-center justify-center
      opacity-0 group-hover:opacity-100 transition
      hover:bg-black/70
    "
              aria-label={`Delete ${item.title}`}
              title="Remove from library"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDelete((item as any).id);
              }}
            >
              <span className="text-white/90 text-sm leading-none">×</span>
            </button>
          ) : null}

          {/* Hover info panel */}
          <div
            className="
    absolute left-0 right-0 bottom-0
    p-2.5
    opacity-0 translate-y-2
    transition duration-200
    group-hover:opacity-100 group-hover:translate-y-0
  "
          >
            {/* ✅ Blur / glass backing so text is always readable */}
            <div
              className="
      absolute inset-0
      bg-black/10
      backdrop-blur-md
      border-t border-white/10
    "
            />

            {/* content must be above the blur layer */}
            <div className="relative">
              <div className="text-sm font-semibold leading-tight line-clamp-2 drop-shadow">
                {item.title}
              </div>

              <div className="mt-1 flex items-center gap-2 text-[11px] opacity-90 drop-shadow">
                {metaYear ? <span>{metaYear}</span> : null}
                {metaRating ? (
                  <span className="opacity-95">{metaRating}</span>
                ) : null}
              </div>

              {metaGenres ? (
                <div className="mt-1 text-[11px] opacity-85 line-clamp-1 drop-shadow">
                  {metaGenres}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={onOpen}
      className="w-full text-left rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition p-4 flex gap-4"
    >
      <div className="w-[88px] h-[88px] rounded-xl overflow-hidden border border-white/10 bg-black/20 shrink-0">
        {item.posterUrl ? (
          <img
            src={item.posterUrl}
            alt={item.title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-xs opacity-60">
            —
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <div className="text-base font-semibold truncate">{item.title}</div>
          {status ? (
            <div className="text-xs opacity-70">{prettyStatus(status)}</div>
          ) : null}
        </div>

        <div className="text-xs opacity-70 mt-1">
          {year}
          {genres.length ? ` · ${genres.slice(0, 3).join(", ")}` : ""}
        </div>

        {item.description ? (
          <div className="text-sm opacity-80 mt-2 line-clamp-2">
            {item.description}
          </div>
        ) : null}

        {rating ? (
          <div className="text-xs opacity-70 mt-2">{rating}</div>
        ) : null}
      </div>
    </button>
  );
}
