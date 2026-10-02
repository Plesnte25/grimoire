import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { fetchAccountPreferences, fetchLibrary } from "../app/api";
import { REGIONS, REGION_LABEL, type CategoryKey } from "../lib/regions";
import type { MediaItem, MediaType } from "../types";
import { statusLabel } from "../lib/status";

const TYPES: { key: MediaType; label: string; note: string }[] = [
  { key: "MOVIE", label: "Movies", note: "Films, gathered" },
  { key: "TV", label: "TV", note: "Series in progress" },
  { key: "ANIME", label: "Anime", note: "Series & films" },
  { key: "BOOK", label: "Books", note: "Read at your pace" },
];

function href(key: CategoryKey) {
  return REGIONS.includes(key as (typeof REGIONS)[number]) ? `/region/${key}` : `/category/${key}`;
}

export function Library() {
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
    const result = new Map<CategoryKey, number>();
    for (const item of visibleItems as MediaItem[]) {
      result.set(item.mediaType, (result.get(item.mediaType) ?? 0) + 1);
      if ((item.mediaType === "TV" || item.mediaType === "MOVIE") && item.region) {
        result.set(item.region, (result.get(item.region) ?? 0) + 1);
      }
    }
    return result;
  }, [visibleItems]);

  const total = visibleItems.length;
  const reading = visibleItems.filter((item) => item.status === "IN_PROGRESS").length;
  const planned = visibleItems.filter((item) => item.status === "PLANNED").length;
  const completed = visibleItems.filter((item) => item.status === "COMPLETED").length;

  return (
    <div className="mx-auto max-w-[1440px] px-5 py-8 md:px-10 md:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-[var(--tx3)]">Your collection</p>
          <h1 className="font-display mt-1 text-4xl font-medium tracking-tight">Library</h1>
        </div>
        <p className="text-sm text-[var(--tx2)]">{isLoading ? "Loading your library…" : `${total} titles`}</p>
      </div>

      {isError ? (
        <div role="alert" className="surface-raised mt-8 rounded-[var(--radius-panel)] p-5 text-sm">
          Couldn't load the library. Try refreshing the page.
        </div>
      ) : null}

      <section aria-label="Library summary" className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-panel)] border border-[var(--line)] bg-[var(--line)] md:grid-cols-4">
        {[
          ["In progress", reading],
          ["Planned", planned],
          ["Completed", completed],
          ["All titles", total],
        ].map(([label, value]) => (
          <div key={label} className="bg-[var(--s1)] px-4 py-4 md:px-5">
            <div className="font-display text-3xl tabular-nums">{isLoading ? "—" : value}</div>
            <div className="mt-1 text-xs text-[var(--tx3)]">{label}</div>
          </div>
        ))}
      </section>

      <section className="mt-10" aria-labelledby="media-heading">
        <h2 id="media-heading" className="font-display text-2xl font-medium">By medium</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {TYPES.map(({ key, label, note }) => (
            <Link key={key} to={href(key)} className="surface-card group rounded-[var(--radius-card)] p-5 no-underline transition-colors hover:bg-[var(--s2)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-display text-2xl font-medium text-[var(--tx)]">{label}</h3>
                  <p className="mt-1 text-sm text-[var(--tx3)]">{note}</p>
                </div>
                <span className="font-display text-3xl tabular-nums text-[var(--tx)]">{counts.get(key) ?? 0}</span>
              </div>
              <div className="mt-5 flex items-center justify-between border-t border-[var(--line)] pt-3 text-sm text-[var(--tx2)]">
                <span>Browse collection</span>
                <span aria-hidden="true" className="text-[var(--acc)]">→</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-10" aria-labelledby="region-heading">
        <h2 id="region-heading" className="font-display text-2xl font-medium">By region</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {REGIONS.map((region) => (
            <Link key={region} to={href(region)} className="surface-card flex min-h-16 items-center justify-between gap-4 rounded-[var(--radius-card)] px-4 py-3 no-underline transition-colors hover:bg-[var(--s2)]">
              <span className="text-sm font-medium text-[var(--tx)]">{REGION_LABEL[region]}</span>
              <span className="text-sm tabular-nums text-[var(--tx3)]">{counts.get(region) ?? 0}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-10" aria-labelledby="continue-heading">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm text-[var(--tx3)]">Pick up where you left off</p>
            <h2 id="continue-heading" className="font-display mt-1 text-2xl font-medium">In progress</h2>
          </div>
        </div>
        <div className="mt-4 divide-y divide-[var(--line)] border-y border-[var(--line)]">
          {visibleItems.filter((item) => item.status === "IN_PROGRESS").slice(0, 5).map((item) => (
            <Link key={item.id} to={`/media/${item.id}`} className="flex min-h-[4.5rem] items-center gap-3 py-3 no-underline">
              <div className="h-14 w-10 shrink-0 overflow-hidden rounded-md bg-[var(--s2)]">
                {item.posterUrl ? <img src={item.posterUrl} alt="" className="h-full w-full object-cover" loading="lazy" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-[var(--tx)]">{item.title}</div>
                <div className="mt-1 text-xs text-[var(--tx3)]">{statusLabel(item.status, item.mediaType)}{item.progressText ? ` · ${item.progressText}` : ""}</div>
              </div>
              <span aria-hidden="true" className="text-[var(--acc)]">→</span>
            </Link>
          ))}
          {!isLoading && visibleItems.every((item) => item.status !== "IN_PROGRESS") ? (
            <p className="py-5 text-sm text-[var(--tx3)]">Nothing in progress yet.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
