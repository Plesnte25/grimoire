import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { MediaItem } from "../types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchLibrary } from "../app/api";
import { safeParseGenres } from "../components/MediaCard";
import { SearchModal } from "../components/SearchModal";
import { SuggestionsCarousel } from "../components/SuggestionsCarousel";

type AnimeTab = "series" | "movies" | "adult";

function norm(s?: string | null) {
  return (s ?? "").toLowerCase();
}

function isAdultAnime(it: any) {
  const gs = safeParseGenres(it?.genres).map((g) => g.toLowerCase());
  const t = norm(it?.title);
  const d = norm(it?.description);

  const adultGenres = [
    "hentai",
    "ecchi",
    "erotica",
    "adult",
    "18+",
    "mature",
    "explicit",
  ];

  if (gs.some((g) => adultGenres.some((k) => g.includes(k)))) return true;

  // Fallback keywords (keep conservative)
  const adultKeywords = ["hentai", "ecchi", "18+", "explicit"];
  if (adultKeywords.some((k) => t.includes(k))) return true;
  if (adultKeywords.some((k) => d.includes(k))) return true;

  return false;
}

function isAnimeMovie(it: any) {
  // Provider/format hints first (AniList commonly has MOVIE/TV/OVA/ONA/SPECIAL)
  const fmt = norm(it?.format || it?.anilistFormat || it?.subtype || it?.kind);
  if (fmt.includes("movie")) return true;

  // Runtime hints
  if (typeof it?.runtimeMinutes === "number" && it.runtimeMinutes > 40)
    return true;
  if (typeof it?.durationMinutes === "number" && it.durationMinutes > 40)
    return true;

  // ProgressText heuristic (your older one)
  // If it contains something like "S2E5 / 12" treat as series.
  const p = norm(it?.progressText);
  const looksSeries = p.includes("/") || (p.includes("s") && p.includes("e"));
  if (looksSeries) return false;

  // If we have no episodic hints, and format isn't TV, lean movie.
  if (fmt && (fmt.includes("tv") || fmt.includes("series"))) return false;

  // Conservative default: not a movie unless we have some signal
  return false;
}

function classifyAnime(it: any): AnimeTab {
  if (isAdultAnime(it)) return "adult";
  if (isAnimeMovie(it)) return "movies";
  return "series";
}

export function Anime() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [searchOpen, setSearchOpen] = useState(false);
  const [tab, setTab] = useState<AnimeTab>("series");

  const { data: items = [] } = useQuery({
    queryKey: ["library", "ANIME"],
    queryFn: () => fetchLibrary("ANIME"),
  });

  // Existing IDs for "Add" button disabling
  const existingProviderIds = useMemo(() => {
    return new Set(
      items
        .filter((it: any) => it?.provider && it?.providerId)
        .map((it: any) => `${it.provider}:${String(it.providerId)}`)
    );
  }, [items]);

  // --- Library tab split (auto) ---
  const animeItems = useMemo(() => {
    const series: MediaItem[] = [];
    const movies: MediaItem[] = [];
    const adult: MediaItem[] = [];

    for (const it of items as any[]) {
      const bucket = classifyAnime(it);
      if (bucket === "movies") movies.push(it);
      else if (bucket === "adult") adult.push(it);
      else series.push(it);
    }

    return { series, movies, adult };
  }, [items]);

  return (
    <div className="min-h-screen px-4 md:px-8 py-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <button
          className="text-sm opacity-70 hover:opacity-100"
          onClick={() => nav("/")}
        >
          ← Back
        </button>

        <button
          className="rounded-xl px-4 py-2 bg-white/10 hover:bg-white/15 transition"
          onClick={() => setSearchOpen(true)}
        >
          + Add
        </button>
      </div>

      <div className="mt-6">
        <div className="text-2xl font-semibold">Anime</div>
        <div className="text-sm opacity-70 mt-1">
          {items.length} total ({animeItems.series.length} series,{" "}
          {animeItems.movies.length} movies, {animeItems.adult.length} 18+)
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-6 flex gap-2 border-b border-white/10">
        <button
          onClick={() => setTab("series")}
          className={`px-4 py-3 font-semibold border-b-2 transition ${
            tab === "series"
              ? "border-white text-white"
              : "border-transparent opacity-60 hover:opacity-80"
          }`}
        >
          TV Series ({animeItems.series.length})
        </button>
        <button
          onClick={() => setTab("movies")}
          className={`px-4 py-3 font-semibold border-b-2 transition ${
            tab === "movies"
              ? "border-white text-white"
              : "border-transparent opacity-60 hover:opacity-80"
          }`}
        >
          Movies ({animeItems.movies.length})
        </button>
        <button
          onClick={() => setTab("adult")}
          className={`px-4 py-3 font-semibold border-b-2 transition ${
            tab === "adult"
              ? "border-white text-white"
              : "border-transparent opacity-60 hover:opacity-80"
          }`}
        >
          Hentai ({animeItems.adult.length})
        </button>
      </div>

      <SuggestionsCarousel
        mediaType="ANIME"
        scope={tab} // "series" | "movies"
        existingProviderIds={existingProviderIds}
        subtitle={
          tab === "series" ? "Showing Series only" : "Showing Movies only"
        }
      />

      <SearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        mediaTypeFilter="ANIME"
      />
    </div>
  );
}
