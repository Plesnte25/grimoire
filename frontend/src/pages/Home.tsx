import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchAccountPreferences, fetchLibrary } from "../app/api";
import type { MediaItem, MediaType } from "../types";
import { REGIONS, REGION_LABEL, effectiveRegion, type CategoryKey } from "../lib/regions";
import { statusLabel } from "../lib/status";
import { useAppSearch } from "../components/AppShell";

const TYPES: { key: MediaType; label: string; verb: string }[] = [
  { key: "MOVIE", label: "Movies", verb: "Browse films" },
  { key: "TV", label: "TV", verb: "Browse series" },
  { key: "ANIME", label: "Anime", verb: "Browse anime" },
  { key: "BOOK", label: "Books", verb: "Browse books" },
];

function categoryHref(key: CategoryKey) {
  return REGIONS.includes(key as (typeof REGIONS)[number]) ? `/region/${key}` : `/category/${key}`;
}

export function Home() {
  const { openSearch } = useAppSearch();
  const navigate = useNavigate();
  const { data: items = [], isLoading, isError } = useQuery({
    queryKey: ["library", "all"],
    queryFn: () => fetchLibrary(),
  });
  const { data: preferences } = useQuery({
    queryKey: ["account-preferences"],
    queryFn: fetchAccountPreferences,
  });
  const visibleItems = items.filter((item) => !item.isAdult || preferences?.showAdultContent);
  const counts = useMemo(() => {
    const map = new Map<CategoryKey, { total: number; progress: number }>();
    for (const item of visibleItems as MediaItem[]) {
      const add = (key: CategoryKey) => {
        const current = map.get(key) ?? { total: 0, progress: 0 };
        current.total++;
        if (item.status === "IN_PROGRESS") current.progress++;
        map.set(key, current);
      };
      add(item.mediaType);
      const region = (item.mediaType === "TV" || item.mediaType === "MOVIE") ? effectiveRegion(item) : null;
      if (region) add(region);
    }
    return map;
  }, [visibleItems]);

  const inProgress = visibleItems.filter((item) => item.status === "IN_PROGRESS").slice(0, 4);
  const recentlyAdded = [...visibleItems].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6);
  const total = visibleItems.length;
  const complete = visibleItems.filter((item) => item.status === "COMPLETED").length;

  return (
    <div className="mx-auto max-w-[1440px] px-5 py-7 md:px-10 md:py-10">
      <section className="grid gap-8 border-b border-[var(--line)] pb-8 md:grid-cols-[minmax(0,1fr)_18rem] md:items-end md:pb-10">
        <div>
          <p className="text-sm text-[var(--tx3)]">A place for the stories you keep</p>
          <h1 className="font-display mt-2 max-w-3xl text-4xl font-medium leading-tight tracking-tight sm:text-5xl">
            Your collection, in progress.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-[var(--tx2)]">
            Pick up a watch, find the next read, or add something you want to remember.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => navigate("/library")}
              className="min-h-11 rounded-xl bg-[var(--accbg)] px-5 text-sm font-semibold text-[var(--acc-ink)] transition-colors hover:brightness-110"
            >
              Open library
            </button>
            <button
              type="button"
              onClick={() => openSearch()}
              className="min-h-11 rounded-xl border border-[var(--line2)] px-5 text-sm font-semibold text-[var(--tx)] transition-colors hover:bg-[var(--s2)]"
            >
              Add a title
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 md:border-l md:border-[var(--line)] md:pl-6">
          <div>
            <div className="font-display text-3xl tabular-nums">{isLoading ? "—" : total}</div>
            <div className="mt-1 text-xs text-[var(--tx3)]">Titles kept</div>
          </div>
          <div>
            <div className="font-display text-3xl tabular-nums">{isLoading ? "—" : complete}</div>
            <div className="mt-1 text-xs text-[var(--tx3)]">Completed</div>
          </div>
        </div>
      </section>

      {isError ? (
        <div role="alert" className="surface-raised mt-6 rounded-[var(--radius-card)] p-4 text-sm">
          Couldn't load your library. You can still browse categories; refresh to try again.
        </div>
      ) : null}

      <section className="mt-8" aria-labelledby="resume-heading">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm text-[var(--tx3)]">A good place to return</p>
            <h2 id="resume-heading" className="font-display mt-1 text-2xl font-medium">Continue</h2>
          </div>
          <Link to="/library" className="min-h-11 inline-flex items-center text-sm text-[var(--acc)] no-underline">See library →</Link>
        </div>
        {inProgress.length ? (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {inProgress.map((item) => (
              <Link key={item.id} to={`/media/${item.id}`} className="surface-card flex min-h-[6.5rem] gap-3 rounded-[var(--radius-card)] p-3 no-underline transition-colors hover:bg-[var(--s2)]">
                <div className="h-20 w-14 shrink-0 overflow-hidden rounded-md bg-[var(--s2)]">
                  {item.posterUrl ? <img src={item.posterUrl} alt="" className="h-full w-full object-cover" loading="lazy" /> : null}
                </div>
                <div className="min-w-0 self-center">
                  <div className="line-clamp-2 text-sm font-semibold text-[var(--tx)]">{item.title}</div>
                  <div className="mt-1 text-xs text-[var(--tx3)]">{statusLabel(item.status, item.mediaType)}</div>
                  {item.progressText ? <div className="mt-1 text-xs tabular-nums text-[var(--tx2)]">{item.progressText}</div> : null}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-[var(--radius-card)] border border-dashed border-[var(--line2)] px-4 py-6 text-sm text-[var(--tx3)]">
            {isLoading ? "Finding your in-progress titles…" : "Nothing in progress. Add a title to start a new chapter."}
          </p>
        )}
      </section>

      <section className="mt-10" aria-labelledby="browse-heading">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm text-[var(--tx3)]">Browse what you have</p>
            <h2 id="browse-heading" className="font-display mt-1 text-2xl font-medium">Library</h2>
          </div>
          <Link to="/library" className="min-h-11 inline-flex items-center text-sm text-[var(--acc)] no-underline">All collections →</Link>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {TYPES.map(({ key, label, verb }) => {
            const count = counts.get(key) ?? { total: 0, progress: 0 };
            return (
              <Link key={key} to={categoryHref(key)} className="surface-card group min-h-36 rounded-[var(--radius-card)] p-4 no-underline transition-colors hover:bg-[var(--s2)] sm:min-h-40 sm:p-5">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-display text-xl font-medium text-[var(--tx)] sm:text-2xl">{label}</span>
                  <span className="text-sm tabular-nums text-[var(--tx3)]">{count.total}</span>
                </div>
                <div className="mt-5 text-xs text-[var(--tx3)]">{count.progress} in progress</div>
                <div className="mt-2 flex items-center justify-between text-sm text-[var(--tx2)]">
                  <span>{verb}</span><span aria-hidden="true" className="text-[var(--acc)]">→</span>
                </div>
              </Link>
            );
          })}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
          {REGIONS.map((region) => (
            <Link key={region} to={categoryHref(region)} className="flex min-h-11 items-center justify-between rounded-xl border border-[var(--line)] px-3 text-sm no-underline transition-colors hover:bg-[var(--s2)]">
              <span className="truncate text-[var(--tx2)]">{REGION_LABEL[region]}</span>
              <span className="ml-2 tabular-nums text-[var(--tx3)]">{counts.get(region)?.total ?? 0}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-10" aria-labelledby="recently-added-heading">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm text-[var(--tx3)]">Recently saved</p>
            <h2 id="recently-added-heading" className="font-display mt-1 text-2xl font-medium">New to your library</h2>
          </div>
        </div>
        {recentlyAdded.length ? (
          <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
            {recentlyAdded.map((item) => (
              <Link key={item.id} to={`/media/${item.id}`} className="min-w-0 text-left no-underline">
                <div className="aspect-[2/3] overflow-hidden rounded-[var(--radius-poster)] bg-[var(--s2)]">
                  {item.posterUrl ? <img src={item.posterUrl} alt="" className="h-full w-full object-cover" loading="lazy" /> : <div className="grid h-full place-items-center text-xs text-[var(--tx3)]">No cover</div>}
                </div>
                <div className="mt-2 line-clamp-2 text-xs font-semibold leading-snug text-[var(--tx)]">{item.title}</div>
                <div className="mt-1 text-[11px] text-[var(--tx3)]">{item.year ?? item.mediaType}</div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-[var(--tx3)]">{isLoading ? "Loading your collection…" : "Your saved titles will appear here."}</p>
        )}
      </section>
    </div>
  );
}
