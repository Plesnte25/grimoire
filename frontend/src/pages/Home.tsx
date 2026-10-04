import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { fetchAccountPreferences, fetchHomeSnapshot, updateItem } from "../app/api";
import type { HomeTitle } from "../types";
import { statusLabel } from "../lib/status";

function PosterLink({ item }: { item: HomeTitle }) {
  return (
    <Link
      to={`/media/${item.id}`}
      aria-label={`Open ${item.title}`}
      className="group relative aspect-[2/3] overflow-hidden rounded-[var(--radius-poster)] bg-[var(--s2)] shadow-lg"
    >
      {item.posterUrl ? <img src={item.posterUrl} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" loading="lazy" /> : (
        <span className="flex h-full items-center justify-center p-3 text-center text-xs text-[var(--tx3)]">{item.title}</span>
      )}
      {item.newEpisodeCount > 0 ? <span className="absolute right-2 top-2 rounded-full bg-[var(--acc)] px-2 py-1 text-[10px] font-bold text-[var(--bg)]">{item.newEpisodeCount} new</span> : null}
    </Link>
  );
}

function PosterShelf({ items, empty, loading }: { items: HomeTitle[]; empty: string; loading: boolean }) {
  if (!items.length) return <p className="mt-4 text-sm text-[var(--tx3)]">{loading ? "Loading titles…" : empty}</p>;
  return (
    <div className="poster-grid mt-5">
      {items.map((item) => (
        <article key={item.id} className="min-w-0">
          <PosterLink item={item} />
          <Link to={`/media/${item.id}`} className="mt-2 block truncate text-sm font-semibold text-[var(--tx)] no-underline hover:text-[var(--acc)]">{item.title}</Link>
          <p className="truncate text-xs text-[var(--tx3)]">{item.year ?? "—"}{item.yourRating ? ` · ★ ${item.yourRating}` : ""}</p>
        </article>
      ))}
    </div>
  );
}

export function Home() {
  const queryClient = useQueryClient();
  const { data: home, isLoading: homeLoading, isError: homeError } = useQuery({
    queryKey: ["home"],
    queryFn: fetchHomeSnapshot,
    staleTime: 60_000,
  });
  const { data: preferences } = useQuery({ queryKey: ["account-preferences"], queryFn: fetchAccountPreferences });
  const updateProgress = useMutation({
    mutationFn: ({ item, done }: { item: HomeTitle; done: boolean }) => updateItem(item.id, {
      status: done ? "COMPLETED" : item.status,
      progressValue: done ? item.progressValue : (item.progressValue ?? 0) + 1,
    }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["home"] }),
        queryClient.invalidateQueries({ queryKey: ["library"] }),
      ]);
    },
  });
  const showAdult = preferences?.showAdultContent ?? false;
  const visible = (values: HomeTitle[] | undefined) => (values ?? []).filter((item) => showAdult || !item.isAdult);
  const recent = visible(home?.recentlyAdded).slice(0, 8);
  const continues = visible(home?.continueWatching).slice(0, 8);
  const releases = visible(home?.newEpisodes).slice(0, 8);

  return (
    <div className="mx-auto max-w-[1440px] px-5 pb-10 pt-20 md:px-10 md:pt-16">
      <header className="mb-10 border-b border-[var(--line)] pb-8">
        <p className="kicker">YOUR STORY, CONTINUING</p>
        <h1 className="font-display mt-2 max-w-3xl text-5xl font-medium leading-[0.98] tracking-tight sm:text-6xl">A shelf for what stays with you.</h1>
      </header>
      {homeError ? <p role="alert" className="surface-raised mb-6 rounded-[var(--radius-card)] p-4 text-sm text-[var(--err)]">Couldn't load all of Home. Refresh to try again.</p> : null}

      <section aria-labelledby="continue-heading" className="mb-12">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="kicker">NOW WATCHING</p>
            <h2 id="continue-heading" className="font-display mt-1 text-3xl font-medium">Continue</h2>
          </div>
          <Link to="/library?status=IN_PROGRESS" className="min-h-11 inline-flex items-center text-sm text-[var(--acc)] no-underline">Your library →</Link>
        </div>
        {continues.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {continues.map((item) => (
              <article key={item.id} className="surface-card flex min-w-0 gap-4 rounded-[var(--radius-card)] p-3">
                <Link to={`/media/${item.id}`} className="h-28 w-20 shrink-0 overflow-hidden rounded-md bg-[var(--s2)]">
                  {item.posterUrl ? <img src={item.posterUrl} alt="" className="h-full w-full object-cover" loading="lazy" /> : null}
                </Link>
                <div className="flex min-w-0 flex-1 flex-col justify-center">
                  <p className="kicker">{statusLabel(item.status, item.mediaType)}</p>
                  <Link to={`/media/${item.id}`} className="mt-1 line-clamp-2 font-semibold text-[var(--tx)] no-underline hover:text-[var(--acc)]">{item.title}</Link>
                  <p className="mt-1 text-xs text-[var(--tx3)]">{item.progressText || item.year || "Pick up where you left off"}</p>
                  <div className="mt-2 flex flex-wrap gap-3">
                    <button type="button" disabled={updateProgress.isPending} onClick={() => updateProgress.mutate({ item, done: false })} className="min-h-11 text-xs font-semibold text-[var(--acc)]">+1 {item.mediaType === "BOOK" ? "page" : "episode"}</button>
                    <button type="button" disabled={updateProgress.isPending} onClick={() => updateProgress.mutate({ item, done: true })} className="min-h-11 text-xs text-[var(--tx2)]">Mark done</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : <p className="text-sm text-[var(--tx3)]">{homeLoading ? "Finding your in-progress titles…" : "Nothing in progress yet. Add something you want to continue."}</p>}
      </section>

      <section aria-labelledby="releases-heading" className="mb-12">
        <div>
          <p className="kicker">FRESH PAGES</p>
          <h2 id="releases-heading" className="font-display mt-1 text-3xl font-medium">New episodes & releases</h2>
        </div>
        <PosterShelf items={releases} loading={homeLoading} empty="No new releases for titles you're following." />
      </section>

      <section aria-labelledby="recent-heading">
        <div>
          <p className="kicker">RECENTLY ADDED</p>
          <h2 id="recent-heading" className="font-display mt-1 text-3xl font-medium">Fresh to your shelves</h2>
        </div>
        <PosterShelf items={recent} loading={homeLoading} empty="Your new additions will show up here." />
      </section>
    </div>
  );
}
