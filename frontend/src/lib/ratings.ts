import type { MediaItem } from "../types";

// Every online score is stored on a 0–10 scale (Google Books' 0–5 is doubled
// server-side). Personal and online ratings are always shown separately.

const SOURCE_LABEL: Record<string, string> = {
  tmdb: "TMDB",
  anilist: "AniList",
  googlebooks: "Google Books",
};

// Below this many votes an average says little (Pakistani dramas often have 2–8).
export const MIN_VOTES = 20;

export type OnlineRating = { value: number; source: string; votes?: number; lowConfidence: boolean };

type RatingFields = Pick<MediaItem, "provider" | "globalRating" | "globalRatingText" | "anilistPopularity">;

export function onlineRating(item: RatingFields): OnlineRating | null {
  if (typeof item.globalRating !== "number") return null;
  const provider = (item.provider ?? "").toLowerCase();
  const source = SOURCE_LABEL[provider] ?? item.provider;
  // TMDB stores "TMDB (6793 votes)" and Google "Google Books (33 ratings)";
  // AniList exposes popularity separately from its average score.
  const m =
    provider === "anilist" ? null : /\((\d+)(?:\s+\w+)?\)/.exec(item.globalRatingText ?? "");
  const votes = provider === "anilist"
    ? item.anilistPopularity ?? undefined
    : m
      ? Number(m[1])
      : undefined;
  return {
    value: item.globalRating,
    source,
    votes,
    lowConfidence: provider !== "anilist" && votes != null && votes < MIN_VOTES,
  };
}

export function personalRating(item: Pick<MediaItem, "yourRating">): number | null {
  return typeof item.yourRating === "number" ? item.yourRating : null;
}

/** 8 → "8", 8.5 → "8.5", 7.934 → "7.9" */
export function formatScore(v: number): string {
  const r = Math.round(v * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

/** 6793 → "6.8k", 950 → "950" */
export function formatVotes(n: number): string {
  if (n >= 1_000_000) return `${formatScore(n / 1_000_000)}M`;
  if (n >= 1_000) return `${formatScore(n / 1_000)}k`;
  return String(n);
}

export function onlineRatingText(r: OnlineRating): string {
  if (r.lowConfidence) return `${r.source}: not enough ratings (${r.votes})`;
  const count = r.votes != null
    ? ` · ${formatVotes(r.votes)} ${r.source === "AniList" ? "users" : "votes"}`
    : "";
  const value = r.source === "AniList" ? `${Math.round(r.value * 10)}%` : formatScore(r.value);
  return `${r.source} ${value}${count}`;
}

export type ScoreChip = { source: string; text: string; label: string };

/**
 * Every online score split into audience vs critics (KNOWN_ISSUES #49).
 * Low-vote audience scores are left out rather than shown as if meaningful.
 */
export function scoreGroups(item: MediaItem): { audience: ScoreChip[]; critics: ScoreChip[] } {
  const audience: ScoreChip[] = [];
  const critics: ScoreChip[] = [];
  const countText = (n?: number | null, noun = "votes") => (n ? ` · ${formatVotes(n)} ${noun}` : "");

  const primary = onlineRating(item);
  if (primary && !primary.lowConfidence) {
    audience.push({
      source: primary.source,
      text: primary.source === "AniList"
        ? `${Math.round(primary.value * 10)}%${countText(primary.votes, "users")}`
        : `${formatScore(primary.value)}${countText(primary.votes)}`,
      label: primary.source === "AniList"
        ? `AniList ${Math.round(primary.value * 10)} percent${primary.votes ? `, ${formatVotes(primary.votes)} users` : ""}`
        : `${primary.source} ${formatScore(primary.value)} out of 10`,
    });
  }
  if (item.imdbRating != null && (item.imdbVotes ?? 0) >= MIN_VOTES) {
    audience.push({ source: "IMDb", text: `${formatScore(item.imdbRating)}${countText(item.imdbVotes)}`, label: `IMDb ${formatScore(item.imdbRating)} out of 10` });
  }
  if (item.malScore != null && (item.malVotes ?? 0) >= MIN_VOTES) {
    audience.push({ source: "MyAnimeList", text: `${formatScore(item.malScore)}${countText(item.malVotes)}`, label: `MyAnimeList ${formatScore(item.malScore)} out of 10` });
  }
  if (item.rtCritics != null) {
    critics.push({ source: "Rotten Tomatoes", text: `${item.rtCritics}%`, label: `Rotten Tomatoes ${item.rtCritics} percent` });
  }
  if (item.metascore != null) {
    critics.push({ source: "Metacritic", text: `${item.metascore}/100`, label: `Metacritic ${item.metascore} out of 100` });
  }
  return { audience, critics };
}
