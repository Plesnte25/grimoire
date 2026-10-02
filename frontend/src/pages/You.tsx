import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchDiary, fetchLibrary } from "../app/api";

export function You() {
  const year = new Date().getFullYear();
  const { data: logs = [] } = useQuery({ queryKey: ["diary", year], queryFn: () => fetchDiary(year) });
  const { data: items = [] } = useQuery({ queryKey: ["library", "all"], queryFn: () => fetchLibrary() });
  const ratingCount = items.filter((item) => item.yourRating != null).length;
  const rated = items.filter((item) => item.yourRating != null);
  const average = rated.length ? rated.reduce((sum, item) => sum + (item.yourRating ?? 0), 0) / rated.length : null;

  return (
    <div className="mx-auto max-w-[1120px] px-5 py-8 md:px-10 md:py-10">
      <p className="text-sm text-[var(--tx3)]">Your history, your taste</p>
      <h1 className="font-display mt-1 text-4xl font-medium tracking-tight">You</h1>

      <section aria-label="Your library stats" className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-panel)] border border-[var(--line)] bg-[var(--line)] md:grid-cols-3">
        <div className="bg-[var(--s1)] p-5">
          <div className="font-display text-3xl tabular-nums">{logs.length}</div>
          <div className="mt-1 text-xs text-[var(--tx3)]">Logs this year</div>
        </div>
        <div className="bg-[var(--s1)] p-5">
          <div className="font-display text-3xl tabular-nums">{ratingCount}</div>
          <div className="mt-1 text-xs text-[var(--tx3)]">Titles rated</div>
        </div>
        <div className="col-span-2 bg-[var(--s1)] p-5 md:col-span-1">
          <div className="font-display text-3xl tabular-nums">{average == null ? "—" : average.toFixed(1)}</div>
          <div className="mt-1 text-xs text-[var(--tx3)]">Average personal rating</div>
        </div>
      </section>

      <section className="mt-10" aria-labelledby="recent-heading">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm text-[var(--tx3)]">{year} diary</p>
            <h2 id="recent-heading" className="font-display mt-1 text-2xl font-medium">Recent logs</h2>
          </div>
          <Link to="/diary" className="min-h-11 inline-flex items-center text-sm text-[var(--acc)] no-underline">Open diary →</Link>
        </div>
        <div className="mt-4 divide-y divide-[var(--line)] border-y border-[var(--line)]">
          {logs.slice(0, 6).map((log) => (
            <Link key={log.id} to={`/media/${log.mediaId}`} className="flex min-h-16 items-center gap-3 py-3 no-underline">
              <div className="h-14 w-10 shrink-0 overflow-hidden rounded-md bg-[var(--s2)]">
                {log.media.posterUrl ? <img src={log.media.posterUrl} alt="" className="h-full w-full object-cover" loading="lazy" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-[var(--tx)]">{log.media.title}</div>
                <div className="mt-1 text-xs text-[var(--tx3)]">{log.finishedAt ? new Date(log.finishedAt).toLocaleDateString() : "In progress"}{log.isRewatch ? " · Rewatch" : ""}</div>
              </div>
              {log.rating != null ? <span className="text-sm font-semibold tabular-nums text-[var(--you)]">✦ {log.rating}</span> : null}
            </Link>
          ))}
          {!logs.length ? <p className="py-5 text-sm text-[var(--tx3)]">Your finished watches and reads will appear here.</p> : null}
        </div>
      </section>

      <section className="mt-10" aria-labelledby="account-heading">
        <h2 id="account-heading" className="font-display text-2xl font-medium">Account</h2>
        <Link to="/settings" className="surface-card mt-4 flex min-h-16 items-center justify-between rounded-[var(--radius-card)] px-4 py-3 text-sm no-underline">
          <span className="text-[var(--tx)]">Settings and appearance</span>
          <span aria-hidden="true" className="text-[var(--acc)]">→</span>
        </Link>
      </section>
    </div>
  );
}
