import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { MediaItem } from "../types";
import { fetchSeasons, type ItemPatch } from "../app/api";

const field =
  "rounded-xl border border-[var(--line2)] bg-[var(--bg)] px-3 min-h-11 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--acc)]";
const button =
  "min-h-11 min-w-11 rounded-xl bg-[var(--s2)] hover:bg-[var(--s3)] text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--acc)] disabled:opacity-40";

/** Total for the counter: your override, else episodes / aired / pages. */
export function progressTotal(item: MediaItem): number | null {
  if (item.progressTotalOverride != null) return item.progressTotalOverride;
  if (item.mediaType === "BOOK") return item.pageCount ?? null;
  return item.episodes ?? item.airedEpisodeCount ?? null;
}

function TotalOverride({ item, onPatch }: { item: MediaItem; onPatch: (p: ItemPatch) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const unit = item.mediaType === "BOOK" ? "pages" : "episodes";

  if (!editing) {
    return (
      <button
        type="button"
        className="text-xs underline underline-offset-2 text-white/75 hover:text-white"
        onClick={() => {
          setDraft(String(item.progressTotalOverride ?? ""));
          setEditing(true);
        }}
      >
        {item.progressTotalOverride != null ? `Custom total: ${item.progressTotalOverride} (change)` : `Different number of ${unit}?`}
      </button>
    );
  }
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const n = draft.trim() === "" ? null : Number(draft);
        if (n === null || (Number.isInteger(n) && n > 0)) {
          onPatch({ progressTotalOverride: n });
          setEditing(false);
        }
      }}
    >
      <label className="text-xs text-white/75" htmlFor="total-override">
        Total {unit} (e.g. a dub split differently; empty = automatic)
      </label>
      <input id="total-override" className={`${field} w-24`} inputMode="numeric" value={draft} onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))} />
      <button className={`${button} px-3 text-sm`} type="submit">Save</button>
      <button className="text-sm underline" type="button" onClick={() => setEditing(false)}>Cancel</button>
    </form>
  );
}

function CounterProgress({ item, onPatch }: { item: MediaItem; onPatch: (p: ItemPatch) => void }) {
  const isBook = item.mediaType === "BOOK";
  const total = progressTotal(item);
  const ongoing = !isBook && item.episodes == null && item.airedEpisodeCount != null && item.progressTotalOverride == null;
  const value = item.progressValue ?? 0;
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);

  const commit = (n: number) => {
    const clamped = Math.max(0, total != null ? Math.min(n, total) : n);
    if (clamped !== value) onPatch({ progressValue: clamped });
    else setDraft(String(value));
  };

  const label = isBook ? "Page" : "Episode";
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="progress-value" className="text-sm text-white/80">{label}</label>
        {!isBook ? (
          <button type="button" className={button} aria-label="One episode back" disabled={value <= 0} onClick={() => commit(value - 1)}>−</button>
        ) : null}
        <input
          id="progress-value"
          className={`${field} w-20 text-center tabular-nums`}
          inputMode="numeric"
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
          onBlur={() => commit(Number(draft || 0))}
          onKeyDown={(e) => e.key === "Enter" && commit(Number(draft || 0))}
        />
        {!isBook ? (
          <button type="button" className={button} aria-label="One more episode" disabled={total != null && value >= total} onClick={() => commit(value + 1)}>+</button>
        ) : null}
        <span className="text-sm tabular-nums text-white/80">
          {total != null ? `/ ${total}${ongoing ? " aired" : ""}` : ""}
        </span>
      </div>
      {total != null && total > 0 ? (
        <div className="h-1.5 w-full max-w-xs rounded-full bg-white/10" aria-hidden="true">
          <div className="h-full rounded-full bg-[var(--acc)]" style={{ width: `${Math.min(100, (value / total) * 100)}%` }} />
        </div>
      ) : null}
      <TotalOverride item={item} onPatch={onPatch} />
    </div>
  );
}

function TvProgress({ item, onPatch }: { item: MediaItem; onPatch: (p: ItemPatch) => void }) {
  const { data: seasons = [], isLoading, isError } = useQuery({
    queryKey: ["seasons", item.id],
    queryFn: () => fetchSeasons(item.id),
    staleTime: 60 * 60 * 1000,
  });

  const season = item.progressSeason ?? (seasons.length ? 1 : null);
  const episode = item.progressEpisode ?? 0;
  const current = seasons.find((s) => s.season === season);
  const totalEpisodes = useMemo(() => seasons.reduce((n, s) => n + s.episodes, 0), [seasons]);

  const save = (s: number, e: number) => {
    const before = seasons.filter((x) => x.season < s).reduce((n, x) => n + x.episodes, 0);
    onPatch({ progressSeason: s, progressEpisode: e, progressValue: before + e });
  };

  if (isLoading) return <p className="text-sm text-white/75">Loading seasons…</p>;
  if (isError || !seasons.length) return <CounterProgress item={item} onPatch={onPatch} />;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm text-white/80" htmlFor="tv-season">Season</label>
        <select
          id="tv-season"
          className={field}
          value={season ?? ""}
          onChange={(e) => save(Number(e.target.value), 0)}
        >
          {seasons.map((s) => (
            <option key={s.season} value={s.season}>{s.name || `Season ${s.season}`}</option>
          ))}
        </select>
        <label className="text-sm text-white/80" htmlFor="tv-episode">Episode</label>
        <select
          id="tv-episode"
          className={field}
          value={episode}
          onChange={(e) => save(season ?? 1, Number(e.target.value))}
        >
          {Array.from({ length: (current?.episodes ?? 0) + 1 }, (_, i) => (
            <option key={i} value={i}>{i === 0 ? "Not started" : `Ep ${i}`}</option>
          ))}
        </select>
        {current && episode < current.episodes ? (
          <button type="button" className={`${button} px-3 text-sm`} onClick={() => save(season ?? 1, episode + 1)}>
            +1 episode
          </button>
        ) : null}
      </div>
      <p className="text-sm tabular-nums text-white/80">
        {item.progressValue ?? 0} / {totalEpisodes} episodes overall
      </p>
    </div>
  );
}

export function ProgressEditor({ item, onPatch }: { item: MediaItem; onPatch: (p: ItemPatch) => void }) {
  if (item.mediaType === "MOVIE") {
    return <p className="text-sm text-[var(--tx3)]">Films don’t have episode progress. Use the rewatch counter when you return to one.</p>;
  }
  if (item.mediaType === "TV" && item.provider === "tmdb") return <TvProgress item={item} onPatch={onPatch} />;
  return <CounterProgress item={item} onPatch={onPatch} />;
}
