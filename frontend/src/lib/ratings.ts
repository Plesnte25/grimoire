import type { MediaItem } from "../types";

// Every online score is stored on a 0–10 scale (Google Books' 0–5 is doubled
// server-side). Personal and online ratings are always shown separately.

const SOURCE_LABEL: Record<string, string> = {
  tmdb: "TMDB",
  anilist: "AniList",
  googlebooks: "Google Books",
};

export type OnlineRating = { value: number; source: string; votes?: number };

type RatingFields = Pick<MediaItem, "provider" | "globalRating" | "globalRatingText">;

export function onlineRating(item: RatingFields): OnlineRating | null {
  if (typeof item.globalRating !== "number") return null;
  const provider = (item.provider ?? "").toLowerCase();
  const source = SOURCE_LABEL[provider] ?? item.provider;
  // TMDB stores "TMDB (6793 votes)" and Google "Google Books (33 ratings)";
  // AniList's parenthesised number is its own score, not a vote count.
  const m =
    provider === "anilist" ? null : /\((\d+)(?:\s+\w+)?\)/.exec(item.globalRatingText ?? "");
  return { value: item.globalRating, source, votes: m ? Number(m[1]) : undefined };
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
  const votes = r.votes != null ? ` · ${formatVotes(r.votes)} votes` : "";
  return `${r.source} ${formatScore(r.value)}${votes}`;
}
