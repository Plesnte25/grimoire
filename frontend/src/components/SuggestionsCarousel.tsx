import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { MediaType } from "../types";
import { addToLibrary, fetchSuggestions } from "../app/api";

type SuggestionItem = {
  provider: string;
  providerId: string;
  mediaType: MediaType;
  title?: string;
  year?: number;
  description?: string;
  posterUrl?: string | null;
  backdropUrl?: string | null;
  globalRating?: number | null;
  globalRatingText?: string | null;
  genres?: string[] | string | null;
};

type Props = {
  mediaType: MediaType;
  existingProviderIds?: Set<string>;
  scope?: string;
  subtitle?: string;
};

function asKey(x: SuggestionItem) {
  return `${x.provider}:${x.providerId}`;
}

function genreList(genres: SuggestionItem["genres"]): string[] {
  if (!genres) return [];
  if (Array.isArray(genres)) return genres.filter(Boolean).map(String);
  if (typeof genres === "string") return [genres];
  return [];
}

function ratingLabel(s: SuggestionItem): string | null {
  if (typeof s.globalRating !== "number") return null;
  return `★ ${s.globalRating.toFixed(1)}`;
}

export function SuggestionsCarousel({
  mediaType,
  existingProviderIds,
  scope,
  subtitle,
}: Props) {
  const qc = useQueryClient();
  // undefined = organic load (benefits from the backend's 2-minute cache bucket);
  // set only by an explicit Refresh click, which always forces a live re-fetch.
  const [refreshSeed, setRefreshSeed] = useState<number | undefined>(undefined);
  const [removed, setRemoved] = useState<Set<string>>(new Set());

  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: ["suggestions", mediaType, scope, refreshSeed],
    queryFn: () => fetchSuggestions(mediaType, scope, refreshSeed),
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  const suggestions = useMemo(() => {
    if (!data) return [];
    const anyData: any = data;

    const merged: SuggestionItem[] = Array.isArray(anyData.results)
      ? anyData.results
      : [
          ...(anyData.becauseYouLike ?? []),
          ...(anyData.nudge ?? []),
          ...(anyData.inProgress ?? []),
        ];

    const seen = new Set<string>();
    const unique = merged.filter((x) => {
      const k = asKey(x);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    const typed = unique.filter((x) => x.mediaType === mediaType);

    // ✅ remove already-in-library items if caller provided
    if (existingProviderIds && existingProviderIds.size > 0) {
      return typed.filter((x) => !existingProviderIds.has(asKey(x)));
    }
    return typed;
  }, [data, existingProviderIds]);

  const displayed = useMemo(() => {
    return suggestions.filter((s) => !removed.has(asKey(s))).slice(0, 20);
  }, [suggestions, removed]);

  const topGenres = useMemo(() => {
    const anyData: any = data;
    return Array.isArray(anyData?.topGenres) ? anyData.topGenres : [];
  }, [data]);

  async function handleQuickAdd(s: SuggestionItem) {
    setRemoved((prev) => {
      const next = new Set(prev);
      next.add(asKey(s));
      return next;
    });

    const normalizedGenres = (
      genres: string[] | string | null | undefined
    ): string[] | undefined => {
      if (!genres) return undefined;
      if (Array.isArray(genres)) return genres;
      if (typeof genres === "string") return [genres];
      return undefined;
    };
    const payload = {
      provider: s.provider,
      providerId: String(s.providerId),
      mediaType: mediaType,
      title: s.title ?? "",
      year: s.year ?? undefined,
      description: s.description ?? undefined,
      posterUrl: s.posterUrl ?? undefined,
      backdropUrl: s.backdropUrl ?? undefined,
      globalRating: s.globalRating ?? undefined,
      globalRatingText: s.globalRatingText ?? undefined,
      genres: normalizedGenres(s.genres),

      status: "PLANNED" as const,
      yourRating: undefined,
      yourNotes: undefined,
      progressText: undefined,
      progressValue: undefined,
    };

    await addToLibrary(payload);

    // refresh library + suggestions
    qc.invalidateQueries({ queryKey: ["library", mediaType] });
    qc.invalidateQueries({ queryKey: ["suggestions", mediaType] });
  }

  const scrollId = `suggestions-strip-${mediaType}`;

  function scrollBy(dir: -1 | 1) {
    const el = document.getElementById(scrollId);
    if (!el) return;
    el.scrollBy({ left: dir * 900, behavior: "smooth" });
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold opacity-90">
            Suggestions · Quick Add
          </div>
          <div className="text-xs opacity-60 mt-1">
            {subtitle
              ? subtitle
              : topGenres.length
              ? `Based on: ${topGenres.slice(0, 6).join(", ")}`
              : "Add a few items (with genres) to get suggestions."}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1 rounded-lg text-sm bg-white/10 hover:bg-white/15 transition"
            onClick={() => {
              setRemoved(new Set());
              setRefreshSeed(Date.now());
            }}
            disabled={isFetching}
            title="Refresh suggestions"
          >
            {isFetching ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      <div
        className="mt-3 relative rounded-2xl border border-white/10 p-3 overflow-hidden"
        style={{
          background:
            "radial-gradient(120% 160% at 0% 0%, rgba(139,92,246,0.10) 0%, rgba(0,0,0,0) 55%), linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
        }}
      >
        {isLoading ? (
          <div className="text-sm opacity-70 py-6 text-center">Analyzing…</div>
        ) : isError ? (
          <div className="text-sm opacity-70 py-6 text-center">
            Couldn’t load suggestions.{" "}
            <button
              className="underline hover:opacity-90"
              onClick={() => {
                setRemoved(new Set());
                setRefreshSeed(Date.now());
              }}
            >
              Retry
            </button>
          </div>
        ) : displayed.length === 0 ? (
          <div className="text-sm opacity-70 py-6 text-center">
            No suggestions yet. Add a few items (with genres) and refresh.
          </div>
        ) : (
          <div className="relative group/rail">
            <button
              className="hidden sm:flex absolute left-1 top-1/2 -translate-y-1/2 z-20 h-11 w-11 rounded-full bg-black/60 hover:bg-black/80 border border-white/15 items-center justify-center opacity-0 group-hover/rail:opacity-100 transition focus-visible:opacity-100"
              onClick={() => scrollBy(-1)}
              aria-label="Scroll left"
            >
              ‹
            </button>
            <button
              className="hidden sm:flex absolute right-1 top-1/2 -translate-y-1/2 z-20 h-11 w-11 rounded-full bg-black/60 hover:bg-black/80 border border-white/15 items-center justify-center opacity-0 group-hover/rail:opacity-100 transition focus-visible:opacity-100"
              onClick={() => scrollBy(1)}
              aria-label="Scroll right"
            >
              ›
            </button>

            <div
              id={scrollId}
              className="
        flex gap-4 overflow-x-auto py-2 px-1
        [scrollbar-width:none] [-ms-overflow-style:none]
        [&::-webkit-scrollbar]:hidden
      "
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              {displayed.map((s) => {
                const genres = genreList(s.genres).slice(0, 2);
                const rating = ratingLabel(s);
                return (
                  <div
                    key={asKey(s)}
                    className="group/card relative w-[180px] shrink-0 transform-gpu transition duration-200 hover:scale-[1.06] hover:z-10"
                  >
                    <div
                      className="h-[270px] rounded-2xl border border-white/10 overflow-hidden bg-black/30 cursor-pointer shadow-lg shadow-black/30 group-hover/card:shadow-2xl group-hover/card:shadow-black/50 transition-shadow"
                      title={s.title ?? ""}
                    >
                      {s.posterUrl ? (
                        <img
                          src={s.posterUrl}
                          alt={s.title ?? ""}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-xs opacity-60">
                          No poster
                        </div>
                      )}

                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />

                      <div className="absolute bottom-2 left-2 right-2">
                        <div className="text-sm font-semibold leading-tight line-clamp-2 drop-shadow">
                          {s.title}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] opacity-85 mt-1 drop-shadow">
                          {s.year ? <span>{s.year}</span> : null}
                          {rating ? <span>{rating}</span> : null}
                        </div>
                        {genres.length ? (
                          <div className="text-[11px] opacity-70 mt-0.5 line-clamp-1 drop-shadow">
                            {genres.join(" · ")}
                          </div>
                        ) : null}
                      </div>

                      <button
                        className="absolute top-2 right-2 min-h-11 min-w-11 px-2 rounded-lg text-xs bg-white/10 hover:bg-white/25 border border-white/10 transition"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQuickAdd(s);
                        }}
                      >
                        + Add
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
