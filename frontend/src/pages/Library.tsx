import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchAccountPreferences, fetchLibrary } from "../app/api";
import { effectiveRegion, REGION_LABEL, REGIONS, type Region } from "../lib/regions";
import type { MediaItem, MediaStatus, MediaType } from "../types";

const TYPES: { key: MediaType; label: string }[] = [
  { key: "MOVIE", label: "Movies" },
  { key: "TV", label: "TV" },
  { key: "ANIME", label: "Anime" },
  { key: "BOOK", label: "Books" },
];
const STATUSES: { key: MediaStatus | "ALL"; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "IN_PROGRESS", label: "Watching" },
  { key: "PLANNED", label: "Planned" },
  { key: "COMPLETED", label: "Completed" },
  { key: "DROPPED", label: "Dropped" },
];
type SortMode = "updated" | "title" | "year" | "rating";

function isMediaType(value: string | null): value is MediaType {
  return TYPES.some((type) => type.key === value);
}
function isRegion(value: string | null): value is Region {
  return REGIONS.some((region) => region === value);
}
function activeChip(active: boolean) {
  return `min-h-11 shrink-0 rounded-full border px-4 text-sm transition-colors ${active ? "border-[var(--acc)] bg-[var(--acc)] text-[var(--bg)]" : "border-[var(--line2)] text-[var(--tx2)] hover:bg-[var(--s2)]"}`;
}

export function Library() {
  const [params, setParams] = useSearchParams();
  const typeParam = params.get("type");
  const type = isMediaType(typeParam) ? typeParam : "MOVIE";
  const regionParam = params.get("region");
  const region = isRegion(regionParam) ? regionParam : null;
  const statusParam = params.get("status");
  const status = STATUSES.some((item) => item.key === statusParam) ? statusParam! : "ALL";
  const animeFormatParam = params.get("anime");
  const animeFormat = animeFormatParam === "MOVIES" ? "MOVIES" : "SERIES";
  const [search, setSearch] = useState("");
  const sort = (params.get("sort") as SortMode | null) ?? "updated";
  const { data: allItems = [], isLoading, isError } = useQuery({ queryKey: ["library", "all"], queryFn: () => fetchLibrary() });
  const { data: preferences } = useQuery({ queryKey: ["account-preferences"], queryFn: fetchAccountPreferences });
  const items = allItems.filter((item) => preferences?.showAdultContent || !item.isAdult);
  const typesForChips = (value: MediaType, selectedRegion: Region | null) => {
    const next = new URLSearchParams(params);
    next.set("type", value);
    if (value !== "TV" && value !== "MOVIE") next.delete("region");
    else if (selectedRegion) next.set("region", selectedRegion);
    if (value !== "ANIME") next.delete("anime");
    setParams(next);
  };
  const counts = useMemo(() => {
    const available: Partial<Record<Region, number>> = {};
    for (const item of items) {
      if (item.mediaType !== "TV" && item.mediaType !== "MOVIE") continue;
      const value = effectiveRegion(item);
      if (value) available[value] = (available[value] ?? 0) + 1;
    }
    return available;
  }, [items]);
  const statusCounts = useMemo(() => {
    const filtered = items.filter((item) => item.mediaType === type && (!region || effectiveRegion(item) === region) &&
      (type !== "ANIME" || (animeFormat === "MOVIES" ? item.format === "MOVIE" : item.format !== "MOVIE")));
    return Object.fromEntries(STATUSES.map(({ key }) => [key, key === "ALL" ? filtered.length : filtered.filter((item) => item.status === key).length]));
  }, [items, type, region, animeFormat]);
  const visible = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    const filtered = items.filter((item) => {
      if (item.mediaType !== type || (region && effectiveRegion(item) !== region)) return false;
      if (type === "ANIME" && (animeFormat === "MOVIES" ? item.format !== "MOVIE" : item.format === "MOVIE")) return false;
      if (status !== "ALL" && item.status !== status) return false;
      if (!query) return true;
      return [item.title, item.nativeTitle, item.creator, item.genres]
        .some((value) => value?.toLocaleLowerCase().includes(query));
    });
    return filtered.sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title);
      if (sort === "year") return (b.year ?? 0) - (a.year ?? 0);
      if (sort === "rating") return (b.yourRating ?? 0) - (a.yourRating ?? 0);
      return b.updatedAt.localeCompare(a.updatedAt);
    });
  }, [items, type, region, animeFormat, status, search, sort]);

  function setFilter(key: string, value: string | null) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  }

  return (
    <div className="mx-auto max-w-[1440px] px-5 pb-10 pt-20 md:px-10 md:pt-16">
      <header className="mb-7">
        <p className="kicker">YOUR COLLECTION</p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="font-display mt-1 text-5xl font-medium tracking-tight">Library</h1>
          <p className="text-sm text-[var(--tx3)]">{isLoading ? "Loading titles…" : `${visible.length} titles`}</p>
        </div>
      </header>

      <nav aria-label="Media type" className="hide-scrollbar flex gap-2 overflow-x-auto pb-2">
        {TYPES.map(({ key, label }) => <button key={key} type="button" className={activeChip(type === key)} aria-pressed={type === key} onClick={() => typesForChips(key, region)}>{label}</button>)}
      </nav>

      {(type === "TV" || type === "MOVIE") && Object.values(counts).some(Boolean) ? (
        <nav aria-label="Region" className="hide-scrollbar mt-2 flex gap-2 overflow-x-auto pb-2">
          <button type="button" className={activeChip(!region)} aria-pressed={!region} onClick={() => setFilter("region", null)}>All regions</button>
          {REGIONS.filter((key) => (counts[key] ?? 0) > 0).map((key) => (
            <button key={key} type="button" className={activeChip(region === key)} aria-pressed={region === key} onClick={() => setFilter("region", key)}>{REGION_LABEL[key]}</button>
          ))}
        </nav>
      ) : null}

      {type === "ANIME" ? (
        <nav aria-label="Anime format" className="hide-scrollbar mt-2 flex gap-2 overflow-x-auto pb-2">
          {(["SERIES", "MOVIES"] as const).map((format) => (
            <button key={format} type="button" className={activeChip(animeFormat === format)} aria-pressed={animeFormat === format} onClick={() => setFilter("anime", format)}>{format === "SERIES" ? "Series" : "Movies"}</button>
          ))}
        </nav>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <label className="sr-only" htmlFor="library-search">Search your library</label>
        <input id="library-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title, original title, genre or creator" className="min-h-12 min-w-0 rounded-[var(--radius-button)] border border-[var(--line2)] bg-[var(--s1)] px-4 text-sm text-[var(--tx)] placeholder:text-[var(--tx3)]" />
        <label className="flex min-h-12 items-center gap-2 rounded-[var(--radius-button)] border border-[var(--line2)] px-3 text-sm text-[var(--tx2)]">
          <span>Sort</span>
          <select value={sort} onChange={(event) => setFilter("sort", event.target.value)} className="min-h-10 max-w-48 bg-transparent text-[var(--tx)]">
            <option value="updated">Recently updated</option><option value="title">Title</option><option value="year">Release year</option><option value="rating">Your rating</option>
          </select>
        </label>
      </div>

      <nav aria-label="Status" className="hide-scrollbar mt-4 flex gap-2 overflow-x-auto pb-2">
        {STATUSES.map(({ key, label }) => <button key={key} type="button" className={activeChip(status === key)} aria-pressed={status === key} onClick={() => setFilter("status", key === "ALL" ? null : key)}>{label}<span className="ml-2 tabular-nums opacity-70">{statusCounts[key]}</span></button>)}
      </nav>

      {isError ? <div role="alert" className="surface-raised mt-6 rounded-[var(--radius-card)] p-4 text-sm text-[var(--err)]">Couldn't load your library. Try refreshing.</div> : null}
      {visible.length ? (
        <div className="poster-grid mt-6">
          {visible.map((item: MediaItem) => (
            <Link key={item.id} to={`/media/${item.id}`} className="group min-w-0 no-underline">
              <div className="relative aspect-[2/3] overflow-hidden rounded-[var(--radius-poster)] bg-[var(--s2)] shadow-lg">
                {item.posterUrl ? <img src={item.posterUrl} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]" /> : <span className="flex h-full items-center justify-center p-3 text-center text-xs text-[var(--tx3)]">{item.title}</span>}
                <span aria-label={item.status.replace("_", " ")} title={item.status.replace("_", " ")} className={`absolute left-2 top-2 h-2.5 w-2.5 rounded-full ring-2 ring-[var(--bg)] ${item.status === "IN_PROGRESS" ? "bg-[var(--acc)]" : item.status === "COMPLETED" ? "bg-[var(--ok)]" : item.status === "DROPPED" ? "bg-[var(--err)]" : "bg-[var(--tx3)]"}`} />
                {item.yourRating != null ? <span className="absolute bottom-2 right-2 rounded-full bg-[var(--bg)]/85 px-2 py-1 text-[10px] font-semibold text-[var(--acc)]">★ {item.yourRating}</span> : null}
              </div>
              <p className="mt-2 line-clamp-2 text-sm font-semibold text-[var(--tx)] group-hover:text-[var(--acc)]">{item.title}</p>
              <p className="text-xs text-[var(--tx3)]">{item.year ?? "—"}</p>
            </Link>
          ))}
        </div>
      ) : !isLoading ? <p className="surface-card mt-6 rounded-[var(--radius-card)] p-6 text-sm text-[var(--tx3)]">No titles match these filters.</p> : null}
    </div>
  );
}
