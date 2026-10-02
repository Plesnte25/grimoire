import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addToLibrary,
  deleteReminder,
  fetchAccountPreferences,
  fetchHomeSnapshot,
  fetchLibrary,
  fetchSuggestions,
  setAnnualGoal,
  setReminder,
} from "../app/api";
import type { HomeTitle, MediaItem, MediaType, ProviderSearchResult } from "../types";
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

function shelfDate(item: HomeTitle) {
  const date = item.nextAirDate ?? item.announcedNextDate ?? item.digitalReleaseDate ?? item.releaseDate;
  return date ? new Date(date).toLocaleDateString(undefined, { dateStyle: "medium" }) : null;
}

function ShelfCard({
  item,
  note,
  onAction,
  actionLabel,
}: {
  item: HomeTitle;
  note?: string;
  onAction?: () => void;
  actionLabel?: string;
}) {
  return (
    <article className="surface-card flex min-w-0 gap-3 rounded-[var(--radius-card)] p-3">
      <Link to={`/media/${item.id}`} aria-label={`Open ${item.title}`} className="h-20 w-14 shrink-0 overflow-hidden rounded-[var(--radius-poster)] bg-[var(--s2)]">
        {item.posterUrl ? <img src={item.posterUrl} alt="" className="h-full w-full object-cover" loading="lazy" /> : null}
      </Link>
      <div className="min-w-0 flex-1">
        <Link to={`/media/${item.id}`} className="line-clamp-2 text-sm font-semibold text-[var(--tx)] no-underline hover:underline">
          {item.title}
        </Link>
        <p className="mt-1 text-xs text-[var(--tx3)]">{note ?? statusLabel(item.status, item.mediaType)}{shelfDate(item) ? ` · ${shelfDate(item)}` : ""}</p>
        {item.newEpisodeCount > 0 ? <p className="mt-1 text-xs font-medium text-[var(--acc)]">{item.newEpisodeCount} new episode{item.newEpisodeCount === 1 ? "" : "s"}</p> : null}
        {onAction && actionLabel ? (
          <button type="button" onClick={onAction} className="mt-1 min-h-11 text-xs font-semibold text-[var(--acc)] underline underline-offset-2">
            {actionLabel}
          </button>
        ) : null}
      </div>
    </article>
  );
}

export function Home() {
  const { openSearch } = useAppSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tonightOpen, setTonightOpen] = useState(false);
  const [goalDraft, setGoalDraft] = useState("");
  const { data: items = [], isLoading, isError } = useQuery({
    queryKey: ["library", "all"],
    queryFn: () => fetchLibrary(),
  });
  const { data: preferences } = useQuery({
    queryKey: ["account-preferences"],
    queryFn: fetchAccountPreferences,
  });
  const {
    data: homeSnapshot,
    isLoading: homeLoading,
    isError: homeError,
  } = useQuery({ queryKey: ["home"], queryFn: fetchHomeSnapshot, staleTime: 60_000 });
  const goalMutation = useMutation({
    mutationFn: (target: number) => setAnnualGoal(new Date().getUTCFullYear(), "ALL", target),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["home"] }),
  });
  const reminderMutation = useMutation({
    mutationFn: ({ id, pinned, untilAt }: { id: string; pinned: boolean; untilAt: string | null }) =>
      setReminder(id, { pinned, untilAt }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["home"] }),
  });
  const removeReminderMutation = useMutation({
    mutationFn: deleteReminder,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["home"] }),
  });
  const tonight = useQuery({
    queryKey: ["tonight-suggestions"],
    enabled: tonightOpen,
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const buckets = await Promise.all([
        fetchSuggestions("MOVIE"),
        fetchSuggestions("TV"),
        fetchSuggestions("ANIME"),
      ]);
      return buckets.flatMap((bucket) => bucket.becauseYouLike ?? []) as ProviderSearchResult[];
    },
  });
  const tonightAdd = useMutation({
    mutationFn: (entry: ProviderSearchResult) => addToLibrary(entry),
    onSuccess: (item) => {
      queryClient.invalidateQueries({ queryKey: ["library"] });
      navigate(`/media/${item.id}`);
    },
  });

  const visibleItems = items.filter((item) => !item.isAdult || preferences?.showAdultContent);
  const visibleHome = <T extends HomeTitle>(values: T[] | undefined) =>
    (values ?? []).filter((item) => !item.isAdult || preferences?.showAdultContent);
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

  const inProgress = visibleHome(homeSnapshot?.continueWatching).slice(0, 4);
  const readyToWatch = visibleHome(homeSnapshot?.readyToWatch).slice(0, 6);
  const comingSoon = visibleHome(homeSnapshot?.comingSoon).slice(0, 6);
  const rewatch = visibleHome(homeSnapshot?.rewatch).slice(0, 4);
  const favourites = (homeSnapshot?.top10 ?? []).flatMap((list) => list.items.map((entry) => entry.media))
    .filter((item) => !item.isAdult || preferences?.showAdultContent)
    .slice(0, 8);
  const annualGoal = homeSnapshot?.goals.find((goal) => goal.scope === "ALL");
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
      {homeError ? (
        <div role="alert" className="surface-raised mt-4 rounded-[var(--radius-card)] p-4 text-sm text-[var(--err)]">
          Couldn’t load Home recommendations and reminders. Refresh to try again.
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

      <section className="mt-10" aria-labelledby="ready-heading">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm text-[var(--tx3)]">Available now</p>
            <h2 id="ready-heading" className="font-display mt-1 text-2xl font-medium">Ready to watch</h2>
          </div>
        </div>
        {readyToWatch.length ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {readyToWatch.map((item) => (
              <ShelfCard
                key={item.id}
                item={item}
                onAction={() => reminderMutation.mutate({ id: item.id, pinned: false, untilAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() })}
                actionLabel="Snooze for a week"
              />
            ))}
          </div>
        ) : <p className="mt-4 text-sm text-[var(--tx3)]">{homeLoading ? "Finding something ready…" : "Nothing waiting to start just yet."}</p>}
      </section>

      <section className="mt-10" aria-labelledby="coming-heading">
        <div>
          <p className="text-sm text-[var(--tx3)]">Release dates and saved reminders</p>
          <h2 id="coming-heading" className="font-display mt-1 text-2xl font-medium">Coming soon</h2>
        </div>
        {comingSoon.length ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {comingSoon.map((item) => (
              <ShelfCard
                key={item.id}
                item={item}
                note={item.reminder?.pinned ? "Pinned reminder" : item.announcedNext ?? item.airStatus ?? "Upcoming"}
                onAction={() => item.reminder?.pinned
                  ? removeReminderMutation.mutate(item.id)
                  : reminderMutation.mutate({ id: item.id, pinned: false, untilAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() })}
                actionLabel={item.reminder?.pinned ? "Remove reminder" : "Snooze for a week"}
              />
            ))}
          </div>
        ) : <p className="mt-4 text-sm text-[var(--tx3)]">{homeLoading ? "Checking release dates…" : "Nothing on the horizon yet."}</p>}
      </section>

      <section className="mt-10" aria-labelledby="tonight-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-[var(--tx3)]">A small prompt for the evening</p>
            <h2 id="tonight-heading" className="font-display mt-1 text-2xl font-medium">What should I watch tonight?</h2>
          </div>
          <button type="button" onClick={() => setTonightOpen(true)} className="min-h-11 rounded-xl border border-[var(--line2)] px-4 text-sm font-semibold text-[var(--tx)] hover:bg-[var(--s2)]">
            {tonight.isFetching ? "Finding picks…" : "Pick a watch"}
          </button>
        </div>
        {tonight.isError ? <p role="alert" className="mt-3 text-sm text-[var(--err)]">Couldn’t find picks right now. Try again in a moment.</p> : null}
        {tonight.data?.length ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {tonight.data.filter((entry) => !entry.isAdult || preferences?.showAdultContent).slice(0, 3).map((entry) => (
              <article key={`${entry.provider}:${entry.providerId}`} className="surface-card flex min-w-0 gap-3 rounded-[var(--radius-card)] p-3">
                <div className="h-20 w-14 shrink-0 overflow-hidden rounded-[var(--radius-poster)] bg-[var(--s2)]">
                  {entry.posterUrl ? <img src={entry.posterUrl} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
                </div>
                <div className="min-w-0 self-center">
                  <h3 className="line-clamp-2 text-sm font-semibold">{entry.title}</h3>
                  <p className="mt-1 text-xs text-[var(--tx3)]">{entry.year ?? entry.mediaType}</p>
                  <button type="button" disabled={tonightAdd.isPending} onClick={() => tonightAdd.mutate(entry)} className="mt-1 min-h-11 text-xs font-semibold text-[var(--acc)] underline underline-offset-2 disabled:opacity-50">
                    {tonightAdd.isPending ? "Adding…" : "Add to library"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>

      <section className="surface-card mt-10 rounded-[var(--radius-panel)] p-4 md:p-5" aria-labelledby="goal-heading">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-[var(--tx3)]">{new Date().getFullYear()} reading and watching</p>
            <h2 id="goal-heading" className="font-display mt-1 text-2xl font-medium">A year’s goal</h2>
          </div>
          <form
            className="flex items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const target = Number(goalDraft || annualGoal?.target);
              if (Number.isInteger(target) && target > 0) goalMutation.mutate(target);
            }}
          >
            <label className="grid gap-1 text-xs text-[var(--tx3)]">
              Titles this year
              <input type="number" min="1" max="10000" className="min-h-11 w-24 rounded-xl border border-[var(--line2)] bg-[var(--s1)] px-3 text-sm text-[var(--tx)]" value={goalDraft || annualGoal?.target || ""} onChange={(event) => setGoalDraft(event.target.value)} />
            </label>
            <button type="submit" disabled={goalMutation.isPending} className="min-h-11 rounded-xl bg-[var(--accbg)] px-4 text-sm font-semibold text-[var(--acc-ink)] disabled:opacity-50">
              {goalMutation.isPending ? "Saving…" : annualGoal ? "Update" : "Set goal"}
            </button>
          </form>
        </div>
        {annualGoal ? (
          <div className="mt-4">
            <div className="flex justify-between text-sm"><span>{annualGoal.completed} of {annualGoal.target} titles finished</span><span className="tabular-nums">{Math.min(100, Math.round(annualGoal.completed / annualGoal.target * 100))}%</span></div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--s2)]"><div className="h-full rounded-full bg-[var(--acc)]" style={{ width: `${Math.min(100, annualGoal.completed / annualGoal.target * 100)}%` }} /></div>
          </div>
        ) : <p className="mt-3 text-sm text-[var(--tx3)]">Set a number that feels right; you can change it any time.</p>}
        {goalMutation.isError ? <p role="alert" className="mt-3 text-sm text-[var(--err)]">Couldn’t save the goal.</p> : null}
      </section>

      {rewatch.length ? (
        <section className="mt-10" aria-labelledby="rewatch-heading">
          <div>
            <p className="text-sm text-[var(--tx3)]">A few you rated highly</p>
            <h2 id="rewatch-heading" className="font-display mt-1 text-2xl font-medium">Worth returning to</h2>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {rewatch.map((item) => <ShelfCard key={item.id} item={item} note={`You rated this ${item.yourRating}/10`} />)}
          </div>
        </section>
      ) : null}

      {favourites.length ? (
        <section className="mt-10" aria-labelledby="favourites-heading">
          <h2 id="favourites-heading" className="font-display text-2xl font-medium">Your favourites</h2>
          <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8">
            {favourites.map((item) => (
              <Link key={item.id} to={`/media/${item.id}`} className="min-w-0 text-left no-underline">
                <div className="aspect-[2/3] overflow-hidden rounded-[var(--radius-poster)] bg-[var(--s2)]">{item.posterUrl ? <img src={item.posterUrl} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}</div>
                <p className="mt-2 line-clamp-2 text-xs font-semibold text-[var(--tx)]">{item.title}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

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
