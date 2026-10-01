import { useMemo, useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { MediaType } from "../types";
import { useQuery } from "@tanstack/react-query";
import { fetchLibrary } from "../app/api";
import { MediaCard, safeParseGenres } from "../components/MediaCard";
import { CardStack } from "../components/ui/CardStack";
import { SearchModal } from "../components/SearchModal";
import { SuggestionsCarousel } from "../components/SuggestionsCarousel";
import { groupByCollection } from "../lib/groupByCollection";
import { STATUSES, statusLabel } from "../lib/status";

type StatusTab =
  | "ALL"
  | "PLANNED"
  | "IN_PROGRESS"
  | "ON_HOLD"
  | "COMPLETED"
  | "DROPPED";

type AnimeTab = "SERIES" | "MOVIES" | "HENTAI";

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
  const { type } = useParams();
  const mediaType = type as MediaType;
  const isAnime = mediaType === "ANIME";

  const nav = useNavigate();

  const [searchOpen, setSearchOpen] = useState(false);

  const [statusTab, setStatusTab] = useState<StatusTab>("ALL");
  const [genreTab, setGenreTab] = useState<string>("ALL");
  const [q, setQ] = useState("");
  const [animeTab, setAnimeTab] = useState<AnimeTab>("SERIES");

  const { data: items = [] } = useQuery({
    queryKey: ["library", mediaType],
    queryFn: () => fetchLibrary(mediaType),
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

    for (const it of items as any[]) {
      buckets[classifyAnime(it)].push(it);
    }

    return buckets;
  }, [isAnime, items]);

  // Base set = category items, narrowed by anime sub-tab if ANIME
  const baseItems = useMemo(() => {
    if (!isAnime) return items as any[];
    return (animeBuckets?.[animeTab] ?? []) as any[];
  }, [isAnime, items, animeBuckets, animeTab]);

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

  // Main displayed list
  const displayed = useMemo(() => {
    const decorated = isAnime
      ? (baseItems as any[]).map(withNativeTitle)
      : (baseItems as any[]);

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

    // 3) search filter (English + native + description)
    const qq = q.trim().toLowerCase();
    const filteredByQuery = !qq
      ? filteredByGenre
      : filteredByGenre.filter((x: any) => {
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

    return [...filteredByQuery].sort((a: any, b: any) =>
      (a.title ?? "").localeCompare(b.title ?? "", undefined, {
        sensitivity: "base",
      })
    );
  }, [baseItems, isAnime, statusTab, genreTab, q]);

  // Franchise/series grouping ("card stack") — groups sharing a collectionId
  // (Phase 4) render as a CardStack; everything else renders as a normal MediaCard.
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
          onClick={() => setSearchOpen(true)}
          aria-label="Add"
          title="Add"
        >
          +
        </button>
      </div>

      {/* Header + Search */}
      <div className="mt-4 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-2xl font-semibold tracking-tight">
            {mediaType}
          </div>

          {/* Total excludes planned */}
          <div className="text-sm opacity-70 mt-1">
            {statusCounts.ALL} items
            {statusCounts.PLANNED ? (
              <span className="opacity-70">
                {" "}
                · {statusCounts.PLANNED} planning
              </span>
            ) : null}
          </div>
        </div>

        <div className="w-[320px] max-w-full">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Search in ${mediaType.toLowerCase()}…`}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-white/20"
          />
        </div>
      </div>

      {/* Anime: sub-tabs */}
      {isAnime ? (
        <div className="mt-4 flex gap-2 flex-wrap">
          {(
            [
              { key: "SERIES", label: "Series" },
              { key: "MOVIES", label: "Movies" },
              { key: "HENTAI", label: "Hentai (18+)" },
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
                  "px-3 py-1 rounded-lg text-sm border transition flex items-center gap-2",
                  animeTab === t.key
                    ? "border-white/30 bg-white/10 opacity-100"
                    : "border-white/10 opacity-60 hover:opacity-90",
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
              "px-3 py-1 rounded-lg text-sm border transition flex items-center gap-2",
              statusTab === s.key
                ? "border-white/30 opacity-100"
                : "border-white/10 opacity-60 hover:opacity-90",
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
              "px-3 py-1 rounded-full text-sm border transition",
              genreTab === g
                ? "border-white/30 bg-white/10 opacity-100"
                : "border-white/10 opacity-60 hover:opacity-90",
            ].join(" ")}
          >
            {g === "ALL" ? "All" : g}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="mt-6" style={{ minHeight: "60vh" }}>
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
            className="
              grid gap-3 md:gap-4
              [grid-template-columns:repeat(auto-fill,minmax(120px,1fr))]
              sm:[grid-template-columns:repeat(auto-fill,minmax(140px,1fr))]
              md:[grid-template-columns:repeat(auto-fill,minmax(170px,1fr))]
              lg:[grid-template-columns:repeat(auto-fill,minmax(190px,1fr))]
            "
          >
            {groupedDisplayed.map((g) =>
              g.stack.length > 1 ? (
                <CardStack
                  key={g.primary.collectionId}
                  items={g.stack}
                  collectionName={g.primary.collectionName}
                  onOpenItem={(it) => nav(`/media/${it.id}`)}
                />
              ) : (
                <MediaCard
                  key={g.primary.id}
                  item={g.primary}
                  onOpen={() => nav(`/media/${g.primary.id}`)}
                  variant="tile"
                />
              )
            )}
          </div>
        )}
      </div>

      {/* Suggestions */}
      <div className="mt-6">
        {isAnime ? (
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

      <SearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        mediaTypeFilter={mediaType}
      />
    </div>
  );
}
