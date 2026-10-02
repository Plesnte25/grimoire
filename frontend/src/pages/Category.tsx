import { useMemo, useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import type { MediaItem, MediaType } from "../types";
import { useQuery } from "@tanstack/react-query";
import { fetchAccountPreferences, fetchLibrary } from "../app/api";
import { MediaCard, safeParseGenres } from "../components/MediaCard";
import { GroupTile } from "../components/GroupTile";
import { useAppSearch } from "../components/AppShell";
import { CountryFlag } from "../components/CountryFlag";
import { SuggestionsCarousel } from "../components/SuggestionsCarousel";
import { groupByCollection } from "../lib/groupByCollection";
import { STATUSES, statusLabel } from "../lib/status";
import { REGION_LABEL, isRegion } from "../lib/regions";

type StatusTab =
  | "ALL"
  | "PLANNED"
  | "IN_PROGRESS"
  | "ON_HOLD"
  | "COMPLETED"
  | "DROPPED";

type AnimeTab = "SERIES" | "MOVIES" | "HENTAI";
type CategorySort = "UPDATED" | "TITLE" | "YEAR";

function classifyAnime(it: any): "SERIES" | "MOVIES" | "HENTAI" {
  const genres = safeParseGenres(it.genres).map((g) => g.toLowerCase());

  // Prefer explicit "adult" signal if it exists in your stored item shape
  const isAdult =
    it?.isAdult === true || it?.adult === true || it?.is_adult === true;

  // HENTAI bucket should be STRICT: actual hentai or explicit adult flag
  const isHentaiGenre = genres.includes("hentai");

  if (isAdult || isHentaiGenre) return "HENTAI";

  // Ecchi is NOT hentai → keep it in normal buckets
  if (String(it.format || "").toUpperCase() === "MOVIE") return "MOVIES";
  return "SERIES";
}

const PAGE_TITLE: Record<MediaType, string> = { MOVIE: "Movies", TV: "TV", ANIME: "Anime", BOOK: "Books" };

function withNativeTitle(it: any) {
  const native =
    it?.nativeTitle ||
    it?.titleNative ||
    it?.japaneseTitle ||
    it?.titleJapanese ||
    it?.native_name ||
    it?.originalTitle;

  const en = it?.title;
  if (!native || !en) return it;

  const a = String(en).trim();
  const b = String(native).trim();
  if (!b || a.toLowerCase() === b.toLowerCase()) return it;

  return { ...it, title: `${a} · ${b}` };
}

// Curated Anime genres (important/common). Show only those present in library.
const IMPORTANT_ANIME_GENRES = [
  "Action",
  "Adventure",
  "Comedy",
  "Drama",
  "Fantasy",
  "Romance",
  "Slice of Life",
  "Sci-Fi",
  "Horror",
  "Mystery",
  "Thriller",
  "Supernatural",
  "Mecha",
  "Sports",
  "Isekai",
  "Psychological",
  "Historical",
  "Shounen",
  "Seinen",
  "Shoujo",
  "Josei",
  "Hentai",
];

export function Category() {
  const { type, key } = useParams();
  // /region/:key is a regional category (its shows + films); /category/:type a media type.
  const region = isRegion(key) ? key : null;
  const mediaType = (region ? "TV" : type) as MediaType;
  const isAnime = mediaType === "ANIME";
  const [regionTab, setRegionTab] = useState<"SERIES" | "MOVIES">("SERIES");

  const nav = useNavigate();

  const { openSearch } = useAppSearch();

  const [statusTab, setStatusTab] = useState<StatusTab>("ALL");
  const [genreTab, setGenreTab] = useState<string>("ALL");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<CategorySort>("UPDATED");
  const [view, setView] = useState<"GRID" | "LIST">("GRID");
  const [q, setQ] = useState("");
  const [animeTab, setAnimeTab] = useState<AnimeTab>("SERIES");

  const { data: items = [] } = useQuery({
    queryKey: ["library", region ?? mediaType],
    queryFn: () => fetchLibrary(region ?? mediaType),
  });
  const { data: preferences } = useQuery({
    queryKey: ["account-preferences"],
    queryFn: fetchAccountPreferences,
  });

  const existingProviderIds = useMemo(() => {
    return new Set(
      items
        .filter((it: any) => it?.provider && it?.providerId)
        .map((it: any) => `${it.provider}:${String(it.providerId)}`)
    );
  }, [items]);

  const STATUS_OPTIONS = useMemo(
    () => [
      { key: "ALL" as const, label: "All" },
      ...STATUSES.map((key) => ({ key, label: statusLabel(key, mediaType) })),
    ],
    [mediaType]
  );

  // ---- Anime buckets (library) ----
  const animeBuckets = useMemo(() => {
    if (!isAnime) return null;

    const buckets: Record<AnimeTab, any[]> = {
      SERIES: [],
      MOVIES: [],
      HENTAI: [],
    };

    for (const it of items as MediaItem[]) {
      if (it.isAdult && !preferences?.showAdultContent) continue;
      buckets[classifyAnime(it)].push(it);
    }

    return buckets;
  }, [isAnime, items, preferences?.showAdultContent]);

  // Base set = category items, narrowed by anime sub-tab if ANIME
  const baseItems = useMemo(() => {
    if (region) {
      return (items as MediaItem[]).filter((item) =>
        item.mediaType === (regionTab === "SERIES" ? "TV" : "MOVIE") &&
        (!item.isAdult || preferences?.showAdultContent)
      );
    }
    if (!isAnime) {
      return (items as MediaItem[]).filter((item) => !item.isAdult || preferences?.showAdultContent);
    }
    const bucket = (animeBuckets?.[animeTab] ?? []) as any[];
    if (animeTab !== "SERIES") return bucket;
    // Series tab: one tile per franchise, so a franchise's movies fold into its
    // tile here too (they also stay listed under Movies).
    const withSeries = new Set(
      bucket.filter((it) => it.franchiseId && it.franchiseRole === "MAIN").map((it) => it.franchiseId)
    );
    const folded = (animeBuckets?.MOVIES ?? []).filter((it: any) => withSeries.has(it.franchiseId));
    return [...bucket, ...folded];
  }, [isAnime, items, animeBuckets, animeTab, region, regionTab, preferences?.showAdultContent]);

  // Reset genre to ALL when switching anime tabs (prevents “stuck” genre)
  useEffect(() => {
    if (isAnime) setGenreTab("ALL");
  }, [animeTab, isAnime]);

  // Global rule: All excludes planned => counter excludes planned
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      ALL: baseItems.filter((x: any) => x.status !== "PLANNED").length,
      PLANNED: 0,
      IN_PROGRESS: 0,
      ON_HOLD: 0,
      COMPLETED: 0,
      DROPPED: 0,
    };

    for (const it of baseItems as any[]) {
      const s = it?.status as StatusTab | undefined;
      if (!s) continue;
      if (counts[s] === undefined) continue;
      counts[s] += 1;
    }

    return counts;
  }, [baseItems]);
  const presentCountries = useMemo(
    () => [...new Set((baseItems as MediaItem[]).map((item) => item.countryOfOrigin).filter((code): code is string => !!code))]
      .sort((a, b) => a.localeCompare(b)),
    [baseItems],
  );

  // Genre chips
  const allGenres = useMemo(() => {
    const present = new Set<string>();
    let hasUnknown = false;

    for (const it of baseItems as any[]) {
      const gs = safeParseGenres(it.genres);
      if (!gs.length) hasUnknown = true;
      else gs.forEach((g) => present.add(g));
    }

    if (isAnime) {
      const curated = IMPORTANT_ANIME_GENRES.filter((g) => present.has(g));
      return ["ALL", ...curated, ...(hasUnknown ? ["Unknown"] : [])];
    }

    const list = Array.from(present).sort((a, b) => a.localeCompare(b));
    return ["ALL", ...(hasUnknown ? ["Unknown", ...list] : list)];
  }, [baseItems, isAnime]);

  const pageTitle = region ? REGION_LABEL[region] : PAGE_TITLE[mediaType];

  // Personal tags/moods used in this category (filter chips; hidden when none).
  const presentTags = useMemo(() => {
    const m = new Map<string, { name: string; kind: string }>();
    for (const it of baseItems as any[]) {
      for (const t of it.tags ?? []) m.set(t.tag.id, { name: t.tag.name, kind: t.tag.kind });
    }
    return [...m.entries()].sort((a, b) => a[1].kind.localeCompare(b[1].kind) || a[1].name.localeCompare(b[1].name));
  }, [baseItems]);

  // Main displayed list
  const displayed = useMemo(() => {
    // English title + original ("Resurrection: Ertugrul · Diriliş: Ertuğrul") everywhere.
    const decorated = (baseItems as any[]).map(withNativeTitle);

    // 1) status filter (GLOBAL RULE)
    const filteredByStatus =
      statusTab === "ALL"
        ? decorated.filter((x: any) => x.status !== "PLANNED")
        : decorated.filter((x: any) => x.status === statusTab);

    // 2) genre filter
    const filteredByGenre =
      genreTab === "ALL"
        ? filteredByStatus
        : filteredByStatus.filter((x: any) => {
            const gs = safeParseGenres(x.genres);
            if (genreTab === "Unknown") return gs.length === 0;
            return gs.includes(genreTab);
          });

    // 2b) personal tag / mood filter
    const filteredByTag = !tagFilter
      ? filteredByGenre
      : filteredByGenre.filter((x: any) => (x.tags ?? []).some((t: any) => t.tag.id === tagFilter));

    // 3) search filter (English + native + description)
    const qq = q.trim().toLowerCase();
    const filteredByQuery = !qq
      ? filteredByTag
      : filteredByTag.filter((x: any) => {
          const t = String(x.title ?? "").toLowerCase();
          const d = String(x.description ?? "").toLowerCase();
          const native = String(
            x.nativeTitle ||
              x.titleNative ||
              x.japaneseTitle ||
              x.titleJapanese ||
              x.native_name ||
              x.originalTitle ||
              ""
          ).toLowerCase();

          return t.includes(qq) || native.includes(qq) || d.includes(qq);
        });

    const filteredByCountry = selectedCountries.length
      ? filteredByQuery.filter((item: MediaItem) => selectedCountries.includes(item.countryOfOrigin ?? ""))
      : filteredByQuery;
    return [...filteredByCountry].sort((a: MediaItem, b: MediaItem) => {
      if (sortBy === "TITLE") return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
      if (sortBy === "YEAR") return (b.year ?? 0) - (a.year ?? 0);
      return b.updatedAt.localeCompare(a.updatedAt);
    });
  }, [baseItems, statusTab, genreTab, tagFilter, q, selectedCountries, sortBy]);

  // Franchise/series grouping ("card stack") — groups sharing a collectionId
  // render as one tile linking to the franchise / collection page; the rest as cards.
  const groupedDisplayed = useMemo(
    () => groupByCollection(displayed),
    [displayed]
  );

  return (
    <div className="min-h-screen px-4 md:px-10 py-6">
      <div className="flex items-center justify-between">
        <button
          className="text-sm opacity-70 hover:opacity-100"
          onClick={() => nav("/")}
        >
          ← Back
        </button>

        <button
          className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/15 transition flex items-center justify-center"
          onClick={() => openSearch(region ? { region } : { mediaTypeFilter: mediaType })}
          aria-label="Add"
          title="Add"
        >
          +
        </button>
      </div>

      {/* Header + Search */}
      <div className="mt-4 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {pageTitle}
          </h1>

          {/* Total excludes planned */}
          <div className="text-sm opacity-70 mt-1">
            {statusCounts.ALL} items
            {statusCounts.PLANNED ? (
              <span className="opacity-70">
                {" "}
                · {statusCounts.PLANNED} planning
              </span>
            ) : null}
            {isAnime && !preferences?.showAdultContent ? (
              <p className="mt-3 text-sm text-[var(--tx3)]">
                18+ titles are hidden. <Link className="text-[var(--acc)] underline underline-offset-2" to="/settings">Enable them in Settings</Link>.
              </p>
            ) : null}
          </div>
        </div>

        <div className="w-[320px] max-w-full">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label={`Search your ${pageTitle}`}
            placeholder={`Search in ${pageTitle}…`}
            className="min-h-11 w-full rounded-xl border border-[var(--line2)] bg-[var(--s1)] px-3 text-sm focus-visible:border-[var(--acc)]"
          />
        </div>
      </div>

      {/* Region: Series / Movies */}
      {region ? (
        <div className="mt-4 flex gap-2 flex-wrap" role="group" aria-label="Shows or films">
          {(["SERIES", "MOVIES"] as const).map((t) => {
            const count = (items as any[]).filter(
              (it) => it.mediaType === (t === "SERIES" ? "TV" : "MOVIE") && it.status !== "PLANNED"
            ).length;
            return (
              <button
                key={t}
                aria-pressed={regionTab === t}
                onClick={() => setRegionTab(t)}
                className={[
                  "min-h-9 px-3 py-1 rounded-lg text-sm border transition flex items-center gap-2",
                  regionTab === t ? "border-[var(--acc)] bg-[var(--s2)]" : "border-[var(--line)] text-[var(--tx2)] hover:text-[var(--tx)]",
                ].join(" ")}
              >
                <span>{t === "SERIES" ? "Series" : "Movies"}</span>
                <span className="text-xs text-white/70">{count}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      {/* Anime: sub-tabs */}
      {isAnime ? (
        <div className="mt-4 flex gap-2 flex-wrap">
          {(
            [
              { key: "SERIES", label: "Series" },
              { key: "MOVIES", label: "Movies" },
              ...(preferences?.showAdultContent ? [{ key: "HENTAI" as const, label: "Hentai (18+)" }] : []),
            ] as const
          ).map((t) => {
            const bucket = animeBuckets?.[t.key] ?? [];
            const count = bucket.filter(
              (x: any) => x.status !== "PLANNED"
            ).length;

            return (
              <button
                key={t.key}
                onClick={() => setAnimeTab(t.key)}
                className={[
                  "min-h-11 px-3 rounded-lg text-sm border transition flex items-center gap-2",
                  animeTab === t.key
                    ? "border-[var(--acc)] bg-[var(--s2)] text-[var(--tx)]"
                    : "border-[var(--line)] text-[var(--tx2)] hover:text-[var(--tx)]",
                ].join(" ")}
              >
                <span>{t.label}</span>
                <span className="text-xs opacity-70">{count}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      {/* Status chips */}
      <div className="mt-4 flex items-center gap-2 flex-wrap">
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s.key}
            onClick={() => setStatusTab(s.key)}
            className={[
              "min-h-11 px-3 rounded-lg text-sm border transition flex items-center gap-2",
              statusTab === s.key
                ? "border-[var(--acc)] bg-[var(--s2)] text-[var(--tx)]"
                : "border-[var(--line)] text-[var(--tx2)] hover:text-[var(--tx)]",
            ].join(" ")}
          >
            <span>{s.label}</span>
            <span className="text-xs opacity-70">
              {statusCounts[s.key] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* Genre chips */}
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        {allGenres.map((g) => (
          <button
            key={g}
            onClick={() => setGenreTab(g)}
            className={[
              "min-h-11 px-3 rounded-full text-sm border transition",
              genreTab === g
                ? "border-[var(--acc)] bg-[var(--s2)] text-[var(--tx)]"
                : "border-[var(--line)] text-[var(--tx2)] hover:text-[var(--tx)]",
            ].join(" ")}
          >
            {g === "ALL" ? "All" : g}
          </button>
        ))}
      </div>

      {/* Personal tags / moods */}
      {presentTags.length ? (
        <div className="mt-3 flex items-center gap-2 flex-wrap" role="group" aria-label="Filter by your tags">
          {presentTags.map(([tagId, t]) => (
            <button
              key={tagId}
              aria-pressed={tagFilter === tagId}
              onClick={() => setTagFilter(tagFilter === tagId ? null : tagId)}
              className={[
                "min-h-9 px-3 rounded-full text-sm border border-dashed transition",
                tagFilter === tagId ? "border-white/60 bg-white/15" : "border-white/25 text-white/80 hover:text-white",
              ].join(" ")}
            >
              {t.kind === "MOOD" ? `Mood: ${t.name}` : `#${t.name}`}
            </button>
          ))}
        </div>
      ) : null}

      {presentCountries.length ? (
        <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter by country">
          {presentCountries.map((code) => {
            const selected = selectedCountries.includes(code);
            return (
              <button
                key={code}
                type="button"
                aria-pressed={selected}
                onClick={() => setSelectedCountries((current) =>
                  selected ? current.filter((value) => value !== code) : [...current, code]
                )}
                className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-3 text-sm ${
                  selected ? "border-[var(--acc)] bg-[var(--s2)]" : "border-[var(--line2)] hover:bg-[var(--s2)]"
                }`}
              >
                <CountryFlag code={code} />
                {code}
              </button>
            );
          })}
        </div>
      ) : null}

      {/* Grid */}
      <div className="mt-6" style={{ minHeight: "60vh" }}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            className="min-h-11 rounded-xl px-3 text-sm text-[var(--tx2)] underline underline-offset-2 hover:bg-[var(--s2)]"
            onClick={() => {
              setStatusTab("ALL");
              setGenreTab("ALL");
              setTagFilter(null);
              setSelectedCountries([]);
              setQ("");
            }}
          >
            Clear filters
          </button>
          <div className="flex items-center gap-2">
            <label className="flex min-h-11 items-center gap-2 text-sm text-[var(--tx2)]">
              Sort
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as CategorySort)}
                className="min-h-11 rounded-xl border border-[var(--line2)] bg-[var(--s1)] px-3 text-[var(--tx)]"
              >
                <option value="UPDATED">Recently updated</option>
                <option value="TITLE">Title</option>
                <option value="YEAR">Year</option>
              </select>
            </label>
            <div className="flex rounded-xl border border-[var(--line2)] p-0.5" role="group" aria-label="View mode">
              {(["GRID", "LIST"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={view === mode}
                  onClick={() => setView(mode)}
                  className={`min-h-10 rounded-lg px-3 text-xs font-semibold ${
                    view === mode ? "bg-[var(--s2)] text-[var(--tx)]" : "text-[var(--tx3)] hover:text-[var(--tx)]"
                  }`}
                >
                  {mode === "GRID" ? "Grid" : "List"}
                </button>
              ))}
            </div>
          </div>
        </div>
        {items.length === 0 ? (
          <div className="text-sm opacity-70">
            No items yet. Click “+” to add your first one.
          </div>
        ) : displayed.length === 0 ? (
          <div className="text-sm opacity-70">
            No results for current filters.
          </div>
        ) : (
          <div
            className={view === "GRID"
              ? "grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3 sm:grid-cols-[repeat(auto-fill,minmax(140px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(170px,1fr))] lg:grid-cols-[repeat(auto-fill,minmax(190px,1fr))] md:gap-4"
              : "grid grid-cols-1 gap-2"}
          >
            {groupedDisplayed.map((g) =>
              g.stack.length > 1 ? (
                <GroupTile
                  key={g.primary.franchiseId ?? g.primary.collectionId}
                  items={g.stack}
                  name={g.name}
                  kind={g.primary.franchiseId ? "franchise" : "collection"}
                />
              ) : (
                <MediaCard
                  key={g.primary.id}
                  item={g.primary}
                  onOpen={() => nav(`/media/${g.primary.id}`)}
                  variant={view === "GRID" ? "tile" : "row"}
                />
              )
            )}
          </div>
        )}
      </div>

      {/* Suggestions */}
      <div className="mt-6">
        {region ? null : isAnime ? (
          <SuggestionsCarousel
            mediaType="ANIME"
            scope={animeTab} // "SERIES" | "MOVIES" | "HENTAI"
            subtitle={
              animeTab === "SERIES"
                ? "Showing Series only"
                : animeTab === "MOVIES"
                ? "Showing Movies only"
                : "Showing Hentai (18+) only"
            }
            existingProviderIds={existingProviderIds}
          />
        ) : (
          <SuggestionsCarousel
            mediaType={mediaType}
            existingProviderIds={existingProviderIds}
          />
        )}
      </div>

    </div>
  );
}
