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

export function SuggestionsCarousel({
  mediaType,
  existingProviderIds,
  scope,
  subtitle,
}: Props) {
  const qc = useQueryClient();
  const [seed, setSeed] = useState<number>(() => Date.now());
  const [removed, setRemoved] = useState<Set<string>>(new Set());

  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: ["suggestions", mediaType, seed, scope],
    queryFn: () => fetchSuggestions(mediaType, seed, scope),
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
              setSeed(Date.now());
            }}
            disabled={isFetching}
            title="Refresh suggestions"
          >
            {isFetching ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3">
        {isLoading ? (
          <div className="text-sm opacity-70">Analyzing…</div>
        ) : isError ? (
          <div className="text-sm opacity-70">
            Couldn’t load suggestions.{" "}
            <button
              className="underline hover:opacity-90"
              onClick={() => {
                setRemoved(new Set());
                setSeed(Date.now());
              }}
            >
              Retry
            </button>
          </div>
        ) : displayed.length === 0 ? (
          <div className="text-sm opacity-70">
            No suggestions yet. Add a few items (with genres) and refresh.
          </div>
        ) : (
          <div
            id={scrollId}
            className="
      flex gap-3 overflow-x-auto pb-2
      [scrollbar-width:none] [-ms-overflow-style:none]
      [&::-webkit-scrollbar]:hidden
    "
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {displayed.map((s) => (
              <div key={asKey(s)} className="group relative w-[160px] shrink-0">
                <div
                  className="h-[240px] rounded-2xl border border-white/10 overflow-hidden bg-black/30 cursor-pointer"
                  title={s.title ?? ""}
                >
                  {s.posterUrl ? (
                    <img
                      src={s.posterUrl}
                      alt={s.title ?? ""}
                      className="h-full w-full object-cover group-hover:scale-[1.02] transition"
                      loading="lazy"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-xs opacity-60">
                      No poster
                    </div>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />

                  <div className="absolute bottom-2 left-2 right-2">
                    <div className="text-sm font-semibold leading-tight line-clamp-2">
                      {s.title}
                    </div>
                    <div className="text-xs opacity-70 mt-0.5">
                      {s.year ?? ""}
                    </div>
                  </div>

                  <button
                    className="absolute top-2 right-2 px-2 py-1 rounded-lg text-xs bg-white/10 hover:bg-white/20 border border-white/10 transition"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleQuickAdd(s);
                    }}
                  >
                    + Add
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
