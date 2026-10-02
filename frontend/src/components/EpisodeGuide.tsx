import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchEpisodes, fetchSeasons } from "../app/api";
import type { MediaItem } from "../types";

export function EpisodeGuide({
  item,
  shieldSpoilers,
}: {
  item: MediaItem;
  shieldSpoilers: boolean;
}) {
  const { data: seasons = [], isLoading: seasonsLoading, isError: seasonsError } = useQuery({
    queryKey: ["seasons", item.id],
    queryFn: () => fetchSeasons(item.id),
    staleTime: 60 * 60 * 1000,
  });
  const [season, setSeason] = useState<number | null>(null);
  const selectedSeason = season ?? seasons[0]?.season ?? 1;
  const {
    data: guide,
    isLoading: episodesLoading,
    isError: episodesError,
  } = useQuery({
    queryKey: ["episodes", item.id, selectedSeason],
    queryFn: () => fetchEpisodes(item.id, selectedSeason),
    enabled: !seasonsLoading && !seasonsError,
    staleTime: 60 * 60 * 1000,
  });
  const [revealed, setRevealed] = useState<string[]>([]);
  const spoilersActive = shieldSpoilers && item.status !== "COMPLETED";

  if (seasonsLoading) return <p className="text-sm text-[var(--tx3)]">Loading seasons…</p>;
  if (seasonsError) return <p role="alert" className="text-sm text-[var(--err)]">Couldn’t load the episode guide. Try again.</p>;
  if (!seasons.length) return <p className="text-sm text-[var(--tx3)]">No season guide is available for this title.</p>;

  return (
    <section aria-labelledby="episodes-heading" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="episodes-heading" className="font-display text-xl font-medium">Episodes</h2>
          <p className="mt-1 text-sm text-[var(--tx3)]">Season guide and release dates</p>
        </div>
        <label className="grid gap-1 text-xs font-medium text-[var(--tx2)]">
          Season
          <select
            className="min-h-11 rounded-xl border border-[var(--line2)] bg-[var(--s1)] px-3 text-sm text-[var(--tx)]"
            value={selectedSeason}
            onChange={(event) => setSeason(Number(event.target.value))}
          >
            {seasons.map((entry) => (
              <option key={entry.season} value={entry.season}>{entry.name || `Season ${entry.season}`}</option>
            ))}
          </select>
        </label>
      </div>
      {episodesLoading ? <p className="text-sm text-[var(--tx3)]">Loading episodes…</p> : null}
      {episodesError ? <p role="alert" className="text-sm text-[var(--err)]">Couldn’t load episodes. Try again.</p> : null}
      {!episodesLoading && !episodesError && !guide?.available ? (
        <p className="rounded-xl border border-dashed border-[var(--line2)] p-4 text-sm text-[var(--tx3)]">
          Episode details aren’t available from the linked provider yet.
        </p>
      ) : null}
      {guide?.episodes.length ? (
        <ol className="divide-y divide-[var(--line)]">
          {guide.episodes.map((episode) => {
            const revealKey = `${episode.seasonNumber}-${episode.episodeNumber}`;
            const isRevealed = !spoilersActive || revealed.includes(revealKey);
            return (
              <li key={episode.id} className="flex gap-3 py-3">
                {episode.stillUrl ? (
                  <img src={episode.stillUrl} alt="" loading="lazy" className="h-16 w-28 shrink-0 rounded-lg object-cover" />
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <h3 className={`text-sm font-semibold ${isRevealed ? "" : "select-none blur-sm"}`}>
                      {episode.episodeNumber}. {episode.name}
                    </h3>
                    {episode.airDate ? (
                      <time className="shrink-0 text-xs text-[var(--tx3)]" dateTime={episode.airDate}>
                        {new Date(`${episode.airDate.slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, { dateStyle: "medium" })}
                      </time>
                    ) : null}
                  </div>
                  {episode.overview ? (
                    <p className={`mt-1 text-sm leading-relaxed text-[var(--tx2)] ${isRevealed ? "" : "select-none blur-sm"}`}>
                      {episode.overview}
                    </p>
                  ) : null}
                  {!isRevealed ? (
                    <button
                      type="button"
                      className="mt-2 min-h-11 text-xs font-semibold text-[var(--acc)] underline underline-offset-2"
                      onClick={() => setRevealed((current) => [...current, revealKey])}
                    >
                      Reveal episode details
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      ) : null}
    </section>
  );
}
