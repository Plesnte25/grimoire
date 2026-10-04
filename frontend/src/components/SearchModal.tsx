import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MediaItem, MediaStatus, MediaType, ProviderSearchResult } from "../types";
import { REGION_LABEL, countryName, type Region } from "../lib/regions";
import { onlineRating, onlineRatingText } from "../lib/ratings";
import { ManualAddForm } from "./ManualAddForm";
import { CountryFlag } from "./CountryFlag";
import { RatingInput } from "./RatingInput";
import { showToast } from "../lib/toast";

type AddPayload = Omit<ProviderSearchResult, "genres"> &
  Partial<Pick<MediaItem, "status" | "yourRating" | "yourNotes" | "progressText" | "progressValue">> &
  { regionOverride?: string | null; genres?: string[] | string };
const PICK_TYPES: MediaType[] = ["MOVIE", "TV", "ANIME", "BOOK"];

const TYPE_LABEL: Record<string, string> = { MOVIE: "Movie", TV: "TV show", ANIME: "Anime", BOOK: "Book" };
import {
  addToLibrary,
  fetchAccountPreferences,
  fetchSuggestions,
  providerDetails,
  providerSearch,
} from "../app/api";

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
  initialItem,
}: {
  open: boolean;
  onClose: () => void;
  mediaTypeFilter?: MediaType;
  region?: Region;
  initialItem?: ProviderSearchResult;
}) {
  const nav = useNavigate();
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [rawResults, setRawResults] = useState<ProviderSearchResult[]>([]);
  const [debounced, setDebounced] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [selected, setSelected] = useState<ProviderSearchResult | null>(null);
  const [status, setStatus] = useState<MediaStatus>("PLANNED");
  const [rating, setRating] = useState<number | null>(null);
  const [progress, setProgress] = useState(1);
  const [regionOverride, setRegionOverride] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const { data: preferences } = useQuery({
    queryKey: ["account-preferences"],
    queryFn: fetchAccountPreferences,
  });
  const pickQueries = useQueries({
    queries: PICK_TYPES.map((type) => ({
      queryKey: ["suggestions", type],
      queryFn: () => fetchSuggestions(type),
      enabled: open && !debounced && !selected,
      staleTime: 5 * 60_000,
    })),
  });
  const quickPicks = pickQueries.flatMap((query) => {
    if (!query.data) return [];
    const entries = Object.values(query.data.byType).flatMap((type) => type.quickPicks);
    return entries
      .filter((item) => (!item.isAdult || preferences?.showAdultContent) && (!mediaTypeFilter || item.mediaType === mediaTypeFilter))
      .slice(0, 2);
  }).slice(0, 6);

  useEffect(() => {
    if (!open) return;
    setQ("");
    setDebounced("");
    setRawResults([]);
    setLoading(false);
    setManualOpen(false);
    setSelected(null);
    setStatus("PLANNED");
    setRating(null);
    setProgress(1);
    setRegionOverride("");
    setAddError(null);
  }, [open]);

  useEffect(() => {
    if (open && !selected) setStatus(preferences?.defaultMediaStatus ?? "PLANNED");
  }, [open, preferences?.defaultMediaStatus, selected]);

  useEffect(() => {
    if (!open || !initialItem) return;
    setSelected(initialItem);
    setStatus(preferences?.defaultMediaStatus ?? "PLANNED");
    setAddError(null);
  }, [open, initialItem]);

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

  async function addSelected() {
    if (!selected) return;
    setAdding(true);
    setAddError(null);
    try {
      const details = await providerDetails(
        selected.provider,
        selected.providerId,
        selected.mediaType
      );

      const payload: AddPayload = {
        ...selected,
        status,
        yourRating: status === "COMPLETED" ? rating : null,
        progressValue: status === "IN_PROGRESS" ? progress : status === "COMPLETED" ? (details?.totalEpisodes ?? details?.pageCount ?? 0) : 0,
        regionOverride: regionOverride || undefined,
      };

      if (details) {
        if (details.genres)
          payload.genres = normalizeGenresForStorage(details.genres);
        else if (selected.genres)
          payload.genres = normalizeGenresForStorage(selected.genres);

        if (details.description && !payload.description)
          payload.description = details.description;
        if (details.backdropUrl) payload.backdropUrl = details.backdropUrl;
        if (details.posterUrl) payload.posterUrl = details.posterUrl;
        if (details.globalRating) payload.globalRating = details.globalRating;
        if (details.globalRatingText)
          payload.globalRatingText = details.globalRatingText;

        if (details.totalEpisodes || details.pageCount) {
          const total = details.totalEpisodes ?? details.pageCount;
          const value = status === "IN_PROGRESS" ? progress : status === "COMPLETED" ? total : 0;
          payload.progressText = `${value}/${total}`;
          payload.progressValue = value;
        }
      } else {
        if (selected.genres)
          payload.genres = normalizeGenresForStorage(selected.genres);
      }

      const created = await addToLibrary(payload);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["library"] }),
        queryClient.invalidateQueries({ queryKey: ["home"] }),
        queryClient.invalidateQueries({ queryKey: ["suggestions"] }),
        queryClient.invalidateQueries({ queryKey: ["franchise"] }),
        queryClient.invalidateQueries({ queryKey: ["collection"] }),
      ]);
      onClose();
      showToast({
        message: `${created.title} added to your library`,
        actionLabel: "Open",
        onAction: () => nav(`/media/${created.id}`),
        timeoutMs: 6000,
      });
    } catch (err) {
      console.error("Failed to add title:", err);
      setAddError("Couldn't add this title. Check your connection and try again.");
    } finally {
      setAdding(false);
    }
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[var(--scrim)] p-0 sm:items-center sm:p-4"
          role="presentation"
          onMouseDown={onClose}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={mediaTypeFilter ? `Add ${mediaTypeFilter}` : "Add to Grimoire"}
            className="surface-card max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-t-[var(--radius-dialog)] pb-[env(safe-area-inset-bottom)] sm:rounded-[var(--radius-dialog)]"
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
                  Search, then choose how to file it
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

              {!debounced && !selected && quickPicks.length ? (
                <section className="mt-5" aria-label="Quick picks">
                  <p className="kicker mb-3">QUICK PICKS</p>
                  <div className="hide-scrollbar flex gap-3 overflow-x-auto pb-2">
                    {quickPicks.map((pick) => (
                      <button key={`${pick.provider}:${pick.providerId}`} type="button" onClick={() => { setSelected(pick); setStatus(preferences?.defaultMediaStatus ?? "PLANNED"); }} className="w-24 shrink-0 text-left">
                        <span className="block aspect-[2/3] overflow-hidden rounded-lg bg-[var(--s2)]">
                          {pick.posterUrl ? <img src={pick.posterUrl} alt="" className="h-full w-full object-cover" loading="lazy" /> : null}
                        </span>
                        <span className="mt-1 block line-clamp-2 text-xs font-semibold">{pick.title}</span>
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}

              {selected ? (
                <section aria-label="Add title details" className="surface-raised mt-4 rounded-[var(--radius-card)] p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-20 w-14 shrink-0 overflow-hidden rounded-md bg-[var(--s2)]">
                      {selected.posterUrl ? <img src={selected.posterUrl} alt="" className="h-full w-full object-cover" /> : null}
                    </div>
                    <div className="min-w-0">
                      <p className="kicker">FILE THIS TITLE</p>
                      <h2 className="truncate font-semibold">{selected.title}</h2>
                      <p className="text-xs text-[var(--tx3)]">{TYPE_LABEL[selected.mediaType] ?? selected.mediaType}{selected.year ? ` · ${selected.year}` : ""}</p>
                    </div>
                    <button type="button" onClick={() => setSelected(null)} className="ml-auto min-h-11 px-2 text-sm text-[var(--tx3)]">Change</button>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1 text-xs font-semibold text-[var(--tx3)]">Status
                      <select value={status} onChange={(event) => setStatus(event.target.value as MediaStatus)} className="min-h-11 rounded-xl border border-[var(--line2)] bg-[var(--s1)] px-3 text-sm text-[var(--tx)]">
                        <option value="PLANNED">Planned</option><option value="IN_PROGRESS">Watching</option><option value="COMPLETED">Completed</option><option value="DROPPED">Dropped</option>
                      </select>
                    </label>
                    {(selected.mediaType === "TV" || selected.mediaType === "ANIME" || selected.mediaType === "BOOK") && status === "IN_PROGRESS" ? (
                      <label className="grid gap-1 text-xs font-semibold text-[var(--tx3)]">Up to {selected.mediaType === "BOOK" ? "page" : "episode"}
                        <input type="number" min="0" value={progress} onChange={(event) => setProgress(Math.max(0, Number(event.target.value)))} className="min-h-11 rounded-xl border border-[var(--line2)] bg-[var(--s1)] px-3 text-sm text-[var(--tx)]" />
                      </label>
                    ) : null}
                    {(selected.mediaType === "TV" || selected.mediaType === "MOVIE") ? (
                      <label className="grid gap-1 text-xs font-semibold text-[var(--tx3)]">Where it's filed
                        <select value={regionOverride} onChange={(event) => setRegionOverride(event.target.value)} className="min-h-11 rounded-xl border border-[var(--line2)] bg-[var(--s1)] px-3 text-sm text-[var(--tx)]">
                          <option value="">Automatic{selected.countryOfOrigin ? ` · ${countryName(selected.countryOfOrigin)}` : ""}</option><option value="NONE">General</option>
                          {Object.entries(REGION_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                        </select>
                      </label>
                    ) : null}
                  </div>
                  {status === "COMPLETED" ? <div className="mt-4"><p className="mb-1 text-xs font-semibold text-[var(--tx3)]">Your rating</p><RatingInput value={rating} onChange={setRating} /></div> : null}
                  {addError ? <p role="alert" className="mt-3 text-sm text-[var(--err)]">{addError}</p> : null}
                  <button type="button" disabled={adding} onClick={addSelected} className="mt-4 min-h-12 w-full rounded-xl bg-[var(--acc)] px-4 font-semibold text-[var(--bg)] disabled:opacity-50">{adding ? "Adding…" : "Add to library"}</button>
                </section>
              ) : null}

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
                    onClick={() => { setSelected(r); setStatus(preferences?.defaultMediaStatus ?? "PLANNED"); setAddError(null); }}
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
                    defaultStatus={preferences?.defaultMediaStatus ?? "PLANNED"}
                    onCancel={() => setManualOpen(false)}
                    onAdded={(id) => {
                      void Promise.all([
                        queryClient.invalidateQueries({ queryKey: ["home"] }),
                        queryClient.invalidateQueries({ queryKey: ["suggestions"] }),
                        queryClient.invalidateQueries({ queryKey: ["media-stats"] }),
                      ]);
                      onClose();
                      showToast({
                        message: "Title added to your library",
                        actionLabel: "Open",
                        onAction: () => nav(`/media/${id}`),
                        timeoutMs: 6000,
                      });
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
