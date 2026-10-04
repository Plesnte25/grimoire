import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchMediaStats } from "../app/api";
import type { MediaType } from "../types";

const TYPE_LABEL: Record<MediaType, string> = { MOVIE: "Movies", TV: "TV", ANIME: "Anime", BOOK: "Books" };
const STATUS_LABEL: Record<string, string> = { PLANNED: "Planned", IN_PROGRESS: "Watching", COMPLETED: "Completed", ON_HOLD: "On hold", DROPPED: "Dropped" };

function StatGroup({ title, values }: { title: string; values: { label: string; count: number }[] }) {
  const max = Math.max(1, ...values.map((item) => item.count));
  return (
    <section className="surface-card rounded-[var(--radius-card)] p-4 md:p-5">
      <h2 className="font-display text-2xl font-medium">{title}</h2>
      <div className="mt-4 space-y-3">
        {values.map(({ label, count }) => (
          <div key={label}>
            <div className="mb-1 flex justify-between gap-3 text-sm"><span className="truncate">{label}</span><span className="tabular-nums text-[var(--tx3)]">{count}</span></div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--s2)]"><div className="h-full rounded-full bg-[var(--acc)]" style={{ width: `${(count / max) * 100}%` }} /></div>
          </div>
        ))}
        {!values.length ? <p className="text-sm text-[var(--tx3)]">Not enough data yet.</p> : null}
      </div>
    </section>
  );
}

export function You() {
  const { data, isLoading, isError } = useQuery({ queryKey: ["media-stats"], queryFn: fetchMediaStats });

  return (
    <div className="mx-auto max-w-[1440px] px-5 pb-10 pt-20 md:px-10 md:pt-16">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-[var(--line)] pb-7">
        <div>
          <p className="kicker">YOUR SHELVES, YOUR TASTE</p>
          <h1 className="font-display mt-1 text-5xl font-medium tracking-tight">You</h1>
        </div>
        <Link to="/settings" className="min-h-11 inline-flex items-center gap-2 rounded-full border border-[var(--line2)] px-4 text-sm font-semibold text-[var(--tx2)] no-underline hover:bg-[var(--s2)]">
          Settings <span aria-hidden="true">↗</span>
        </Link>
      </header>
      {isError ? <p role="alert" className="surface-raised rounded-[var(--radius-card)] p-4 text-sm text-[var(--err)]">Couldn’t load your stats. Try refreshing.</p> : null}
      {isLoading || !data ? <p className="py-8 text-sm text-[var(--tx3)]">Gathering your library…</p> : (
        <div className="space-y-10">
          <section aria-labelledby="totals-heading">
            <p className="kicker">LIBRARY TOTALS</p>
            <h2 id="totals-heading" className="font-display mt-1 text-3xl font-medium">A collection taking shape</h2>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {data.libraryTotals.byMediaType.map(({ mediaType, count }) => (
                <Link key={mediaType} to={`/library?type=${mediaType}`} className="surface-card rounded-[var(--radius-card)] p-4 no-underline transition-transform hover:-translate-y-1">
                  <p className="kicker">{TYPE_LABEL[mediaType]}</p><p className="font-display mt-1 text-4xl tabular-nums text-[var(--tx)]">{count}</p>
                </Link>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-5">
              {data.libraryTotals.byStatus.map(({ status, count }) => (
                <div key={status} className="surface-card rounded-[var(--radius-card)] p-3"><p className="text-xs text-[var(--tx3)]">{STATUS_LABEL[status] ?? status}</p><p className="mt-1 text-xl font-semibold tabular-nums">{count}</p></div>
              ))}
            </div>
            <p className="mt-3 text-sm text-[var(--tx2)]">{data.libraryTotals.totalTitles} titles · {data.libraryTotals.totalEpisodesTracked} / {data.libraryTotals.totalEpisodesAvailable} episodes · {data.libraryTotals.totalPagesTracked} / {data.libraryTotals.totalPagesAvailable} pages</p>
          </section>

          <section aria-labelledby="ratings-heading">
            <p className="kicker">YOUR RATINGS</p><h2 id="ratings-heading" className="font-display mt-1 text-3xl font-medium">What stayed with you</h2>
            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]">
              <div className="surface-card rounded-[var(--radius-card)] p-4 md:p-5">
                <div className="flex flex-wrap gap-x-8 gap-y-2">
                  <p><span className="block text-xs text-[var(--tx3)]">Your average</span><strong className="font-display text-3xl">{data.ratings.averagePersonalRating?.toFixed(1) ?? "—"}</strong></p>
                  <p><span className="block text-xs text-[var(--tx3)]">Provider average</span><strong className="font-display text-3xl">{data.ratings.averageProviderRating?.toFixed(1) ?? "—"}</strong></p>
                </div>
                <div className="mt-5 grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-2 text-xs">
                  {data.ratings.distribution.map(({ rating, count }) => (
                    <div key={rating} className="contents"><span className="tabular-nums text-[var(--tx2)]">{rating}</span><div className="h-2 rounded-full bg-[var(--s2)]"><div className="h-full rounded-full bg-[var(--acc)]" style={{ width: `${(count / Math.max(1, ...data.ratings.distribution.map((entry) => entry.count))) * 100}%` }} /></div><span className="tabular-nums text-[var(--tx3)]">{count}</span></div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {data.ratings.highestRatedByType.map(({ mediaType, item }) => item ? (
                  <Link key={mediaType} to={`/media/${item.id}`} className="surface-card flex min-w-0 gap-3 rounded-[var(--radius-card)] p-3 no-underline">
                    <div className="h-20 w-14 shrink-0 overflow-hidden rounded-md bg-[var(--s2)]">{item.posterUrl ? <img src={item.posterUrl} alt="" className="h-full w-full object-cover" loading="lazy" /> : null}</div>
                    <div className="min-w-0 self-center"><p className="kicker">{TYPE_LABEL[mediaType]}</p><p className="mt-1 line-clamp-2 text-sm font-semibold">{item.title}</p><p className="mt-1 text-xs text-[var(--acc)]">★ {item.yourRating}</p></div>
                  </Link>
                ) : null)}
              </div>
            </div>
          </section>

          <section aria-labelledby="taste-heading">
            <p className="kicker">TASTE PROFILE</p><h2 id="taste-heading" className="font-display mt-1 text-3xl font-medium">The patterns in your shelves</h2>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <StatGroup title="Genres" values={data.tasteProfile.topGenres.slice(0, 8).map(({ genre, count }) => ({ label: genre, count }))} />
              <StatGroup title="Countries" values={data.tasteProfile.countries.slice(0, 8).map(({ country, count }) => ({ label: country, count }))} />
              <StatGroup title="Release decades" values={data.tasteProfile.releaseDecades.map(({ decade, count }) => ({ label: decade, count }))} />
              <StatGroup title="Creators & studios" values={data.tasteProfile.topContributors.slice(0, 8).map(({ name, role, count }) => ({ label: `${name} · ${role.toLowerCase()}`, count }))} />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
