import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type { MediaType } from "../types";
import { REGION_LABEL, countryName, type Region } from "../lib/regions";
import { onlineRating, onlineRatingText } from "../lib/ratings";
import { ManualAddForm } from "./ManualAddForm";
import { CountryFlag } from "./CountryFlag";

const TYPE_LABEL: Record<string, string> = { MOVIE: "Movie", TV: "TV show", ANIME: "Anime", BOOK: "Book" };
import {
  addToLibrary,
  fetchAccountPreferences,
  providerDetails,
  providerSearch,
  updateLibrary,
} from "../app/api";

type ProviderSearchResult = {
  provider: string;
  providerId: string;
  mediaType: MediaType;
  title: string;
  nativeTitle?: string;
  countryOfOrigin?: string;
  originalLanguage?: string;
  isAdult?: boolean;
  isDub?: boolean;
  year?: string;
  posterUrl?: string;
  backdropUrl?: string;
  description?: string;
  globalRating?: number;
  globalRatingText?: string;
  genres?: string[] | string;
};

function normalizeGenresForStorage(genres: unknown): string | undefined {
  if (!genres) return undefined;

  if (typeof genres === "string") {
    // If already JSON array string, keep it. Otherwise convert "Action, Drama" -> JSON.
    try {
      const parsed = JSON.parse(genres);
      if (Array.isArray(parsed)) return JSON.stringify(parsed.filter(Boolean));
    } catch {
      const parts = genres
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      return parts.length ? JSON.stringify(parts) : undefined;
    }
    return genres;
  }

  if (Array.isArray(genres)) {
    const arr = genres
      .map(String)
      .map((s) => s.trim())
      .filter(Boolean);
    return arr.length ? JSON.stringify(arr) : undefined;
  }

  return undefined;
}

export function SearchModal({
  open,
  onClose,
  mediaTypeFilter, // undefined on landing page, defined inside category page
  region, // set on a regional category page: shows + films, that region first
}: {
  open: boolean;
  onClose: () => void;
  mediaTypeFilter?: MediaType;
  region?: Region;
}) {
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [rawResults, setRawResults] = useState<ProviderSearchResult[]>([]);
  const [debounced, setDebounced] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const { data: preferences } = useQuery({
    queryKey: ["account-preferences"],
    queryFn: fetchAccountPreferences,
  });

  useEffect(() => {
    if (!open) return;
    setQ("");
    setDebounced("");
    setRawResults([]);
    setLoading(false);
    setManualOpen(false);
  }, [open]);

  // debounce typing
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => setDebounced(q.trim()), 250);
    return () => window.clearTimeout(id);
  }, [q, open]);

  const placeholder = useMemo(() => {
    if (region) return `Search ${REGION_LABEL[region]} shows and films…`;
    if (!mediaTypeFilter) return "Search movies, shows, anime, books…";
    const m: Record<MediaType, string> = {
      MOVIE: "Search movies…",
      TV: "Search TV shows…",
      ANIME: "Search anime…",
      BOOK: "Search books…",
    };
    return m[mediaTypeFilter] ?? "Search…";
  }, [mediaTypeFilter]);

  // IMPORTANT: call providerSearch(query) WITHOUT filter param
  // then filter client-side so it works even if backend doesn't support params.
  useEffect(() => {
    if (!open) return;
    if (!debounced) {
      setRawResults([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const res = await providerSearch(debounced, undefined, region);
        if (cancelled) return;
        setRawResults((res ?? []) as ProviderSearchResult[]);
      } catch (e) {
        console.error(e);
        if (!cancelled) setRawResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [debounced, open]);

  const results = useMemo(() => {
    return rawResults.filter((r) =>
      (!mediaTypeFilter || r.mediaType === mediaTypeFilter) &&
      (!r.isAdult || preferences?.showAdultContent)
    );
  }, [rawResults, mediaTypeFilter, preferences?.showAdultContent]);

  async function add(item: ProviderSearchResult) {
    try {
      const details = await providerDetails(
        item.provider,
        item.providerId,
        item.mediaType
      );

      const payload: any = { ...item };

      if (details) {
        if (details.genres)
          payload.genres = normalizeGenresForStorage(details.genres);
        else if (item.genres)
          payload.genres = normalizeGenresForStorage(item.genres);

        if (details.description && !payload.description)
          payload.description = details.description;
        if (details.backdropUrl) payload.backdropUrl = details.backdropUrl;
        if (details.posterUrl) payload.posterUrl = details.posterUrl;
        if (details.globalRating) payload.globalRating = details.globalRating;
        if (details.globalRatingText)
          payload.globalRatingText = details.globalRatingText;

        // init progress
        if (details.totalEpisodes || details.runtime) {
          const total = details.totalEpisodes ?? details.runtime;
          payload.progressText = `0/${total}`;
          payload.progressValue = 0;
        }
      } else {
        if (item.genres)
          payload.genres = normalizeGenresForStorage(item.genres);
      }

      const created = await addToLibrary(payload);

      // patch progress if create ignores it
      if (payload.progressText) {
        try {
          await updateLibrary(created.id, {
            progressText: payload.progressText,
            progressValue: payload.progressValue,
          });
        } catch {
          // ignore
        }
      }

      onClose();
      nav(`/media/${created.id}`);
    } catch (err) {
      console.error("Failed to add:", err);
    }
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--scrim)] p-4"
          role="presentation"
          onMouseDown={onClose}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={mediaTypeFilter ? `Add ${mediaTypeFilter}` : "Add to Grimoire"}
            className="surface-card w-full max-w-3xl overflow-hidden rounded-[var(--radius-dialog)]"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold opacity-90">
                  {mediaTypeFilter
                    ? `Add ${mediaTypeFilter}`
                    : "Add to Grimoire"}
                </div>
                <div className="text-xs opacity-60 mt-0.5">
                  Type to search — click a result to add instantly
                </div>
              </div>

              <button
                className="min-h-11 rounded-xl px-3 text-sm text-[var(--tx2)] transition-colors hover:bg-[var(--s2)] hover:text-[var(--tx)]"
                onClick={onClose}
              >
                Close
              </button>
            </div>

            {/* Search */}
            <div className="p-5">
              <div className="flex items-center gap-3">
                <input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="min-h-11 flex-1 rounded-xl border border-[var(--line2)] bg-[var(--s1)] px-4 py-3 text-[var(--tx)] transition-colors focus-visible:border-[var(--acc)]"
                  placeholder={placeholder}
                />
                <div className="text-xs opacity-60 min-w-[92px] text-right">
                  {loading
                    ? "Searching…"
                    : results.length
                    ? `${results.length} found`
                    : ""}
                </div>
              </div>

              {/* Results */}
              <div className="mt-4 max-h-[60vh] overflow-auto space-y-2 pr-1">
                {!loading && debounced && results.length === 0 && (
                  <div className="text-sm opacity-70 px-2 py-6">
                    No results. Try a slightly different spelling.
                  </div>
                )}

                {!debounced && (
                  <div className="text-sm opacity-60 px-2 py-6">
                    Try: “Interstellar”, “Attack on Titan”, “The Alchemist”,
                    “Adele Hello”
                  </div>
                )}

                {results.map((r) => (
                  <button
                    key={`${r.provider}:${r.providerId}`}
                    className="surface-card w-full overflow-hidden rounded-[var(--radius-card)] text-left transition-colors hover:bg-[var(--s2)]"
                    onClick={() => add(r)}
                  >
                    <div className="flex gap-4 p-3">
                      <div className="h-20 w-14 flex-shrink-0 overflow-hidden rounded-[var(--radius-poster)] bg-[var(--s2)]">
                        {r.posterUrl ? (
                          <img
                            src={r.posterUrl}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : null}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="font-semibold truncate">{r.title}</div>
                        {r.nativeTitle ? (
                          <div className="text-sm text-white/80 truncate" lang={r.originalLanguage} dir={r.originalLanguage === "ur" ? "rtl" : undefined}>{r.nativeTitle}</div>
                        ) : null}
                        <div className="text-xs text-white/80 mt-1 flex flex-wrap items-center gap-x-1.5">
                          <span>{TYPE_LABEL[r.mediaType] ?? r.mediaType}</span>
                          {r.year ? <span>· {r.year}</span> : null}
                          {r.countryOfOrigin ? (
                            <span>
                              · <CountryFlag code={r.countryOfOrigin} /> {countryName(r.countryOfOrigin)}
                            </span>
                          ) : null}
                          {(() => {
                            const online = onlineRating(r as any);
                            return online && !online.lowConfidence ? <span>· {onlineRatingText(online)}</span> : null;
                          })()}
                          {r.isDub ? (
                            <span className="ml-1 rounded-full border border-[var(--warn)] px-2 py-0.5 text-[11px] text-[var(--warn)]">
                              Dub
                            </span>
                          ) : null}
                        </div>
                        {r.description ? (
                          <div className="text-xs opacity-60 mt-2 line-clamp-2">
                            {r.description}
                          </div>
                        ) : null}
                      </div>

                      <div className="flex items-end">
                        <span className="text-xs px-3 py-2 rounded-full bg-white/10 border border-white/10">
                          + Add
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-4 border-t border-white/10 pt-4">
                {manualOpen ? (
                  <ManualAddForm
                    defaultType={mediaTypeFilter ?? (region ? "TV" : "TV")}
                    defaultCountry={region && region !== "EU" ? region : ""}
                    defaultTitle={q.trim()}
                    onCancel={() => setManualOpen(false)}
                    onAdded={(id) => {
                      onClose();
                      nav(`/media/${id}`);
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    className="min-h-11 text-sm underline underline-offset-2 text-white/85 hover:text-white"
                    onClick={() => setManualOpen(true)}
                  >
                    Can't find it? Add it manually
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
