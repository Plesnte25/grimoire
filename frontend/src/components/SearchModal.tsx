import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { MediaType } from "../types";
import {
  addToLibrary,
  providerDetails,
  providerSearch,
  updateLibrary,
} from "../app/api";

type ProviderSearchResult = {
  provider: string;
  providerId: string;
  mediaType: MediaType;
  title: string;
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

const EASE = [0.22, 1, 0.36, 1] as const;

export function SearchModal({
  open,
  onClose,
  mediaTypeFilter, // undefined on landing page, defined inside category page
}: {
  open: boolean;
  onClose: () => void;
  mediaTypeFilter?: MediaType;
}) {
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [rawResults, setRawResults] = useState<ProviderSearchResult[]>([]);
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    if (!open) return;
    setQ("");
    setDebounced("");
    setRawResults([]);
    setLoading(false);
  }, [open]);

  // debounce typing
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => setDebounced(q.trim()), 250);
    return () => window.clearTimeout(id);
  }, [q, open]);

  const placeholder = useMemo(() => {
    if (!mediaTypeFilter) return "Search movies, shows, anime, books, songs…";
    const m: Record<MediaType, string> = {
      MOVIE: "Search movies…",
      TV: "Search TV shows…",
      ANIME: "Search anime…",
      BOOK: "Search books…",
      MUSIC: "Search songs…",
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
        const res = await providerSearch(debounced);
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
    if (!mediaTypeFilter) return rawResults;
    return rawResults.filter((r) => r.mediaType === mediaTypeFilter);
  }, [rawResults, mediaTypeFilter]);

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

        // init progress for non-music
        if (
          (details.totalEpisodes || details.runtime) &&
          item.mediaType !== "MUSIC"
        ) {
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
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={onClose}
        >
          <motion.div
            className="w-full max-w-3xl rounded-3xl overflow-hidden border border-white/10 bg-black/40 backdrop-blur-xl"
            initial={{ y: 18, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 18, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.22, ease: EASE }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold opacity-90">
                  {mediaTypeFilter
                    ? `Add ${mediaTypeFilter}`
                    : "Add to MediaVault"}
                </div>
                <div className="text-xs opacity-60 mt-0.5">
                  Type to search — click a result to add instantly
                </div>
              </div>

              <button
                className="text-sm opacity-70 hover:opacity-100 px-3 py-2 rounded-xl hover:bg-white/10 transition"
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
                  className="flex-1 rounded-2xl bg-black/35 border border-white/10 px-5 py-4 outline-none focus:border-white/20 transition"
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
                    className="w-full text-left rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 hover:shadow-lg hover:shadow-black/30 hover:-translate-y-0.5 transition-all overflow-hidden"
                    onClick={() => add(r)}
                  >
                    <div className="flex gap-4 p-3">
                      <div className="w-14 h-20 rounded-xl overflow-hidden bg-white/5 flex-shrink-0 shadow-md shadow-black/40">
                        {r.posterUrl ? (
                          <img
                            src={r.posterUrl}
                            alt={r.title}
                            className="w-full h-full object-cover"
                          />
                        ) : null}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="font-semibold truncate">{r.title}</div>
                        <div className="text-xs opacity-70 mt-1">
                          {r.mediaType}
                          {r.year ? ` · ${r.year}` : ""}
                          {typeof r.globalRating === "number"
                            ? ` · ⭐ ${r.globalRating}`
                            : ""}
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
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
