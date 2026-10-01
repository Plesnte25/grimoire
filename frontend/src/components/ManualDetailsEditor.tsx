import { useState } from "react";
import type { MediaItem } from "../types";

const field = "w-full min-h-11 rounded-xl bg-black/30 border border-white/15 px-3 text-sm";

type Patch = { title?: string; year?: number | null; countryOfOrigin?: string | null; episodes?: number | null; posterUrl?: string | null };

/** Edit form for manually added items (provider items stay in sync with their source). */
export function ManualDetailsEditor({ item, onPatch }: { item: MediaItem; onPatch: (p: Patch) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [year, setYear] = useState(item.year ? String(item.year) : "");
  const [country, setCountry] = useState(item.countryOfOrigin ?? "");
  const [episodes, setEpisodes] = useState(item.episodes ? String(item.episodes) : "");
  const [posterUrl, setPosterUrl] = useState(item.posterUrl ?? "");
  const series = item.mediaType === "TV" || item.mediaType === "ANIME";

  if (!open) {
    return (
      <button type="button" className="min-h-11 rounded-xl bg-white/10 px-4 text-sm hover:bg-white/15" onClick={() => setOpen(true)}>
        Edit details (added manually)
      </button>
    );
  }
  return (
    <form
      className="space-y-3 rounded-2xl border border-white/10 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        onPatch({
          title: title.trim() || item.title,
          year: year ? Number(year) : null,
          countryOfOrigin: /^[A-Za-z]{2}$/.test(country) ? country.toUpperCase() : null,
          ...(series ? { episodes: episodes ? Number(episodes) : null } : {}),
          posterUrl: /^https?:\/\//.test(posterUrl) ? posterUrl : null,
        });
        setOpen(false);
      }}
    >
      <h2 className="text-sm font-semibold">Edit details</h2>
      <label className="block space-y-1 text-sm"><span className="text-white/80">Title</span><input className={field} value={title} onChange={(e) => setTitle(e.target.value)} required /></label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="space-y-1 text-sm"><span className="text-white/80">Year</span><input className={field} inputMode="numeric" maxLength={4} value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, ""))} /></label>
        <label className="space-y-1 text-sm"><span className="text-white/80">Country (2 letters)</span><input className={field} maxLength={2} value={country} onChange={(e) => setCountry(e.target.value.toUpperCase())} /></label>
        {series ? (
          <label className="space-y-1 text-sm"><span className="text-white/80">Episodes</span><input className={field} inputMode="numeric" value={episodes} onChange={(e) => setEpisodes(e.target.value.replace(/\D/g, ""))} /></label>
        ) : null}
      </div>
      <label className="block space-y-1 text-sm"><span className="text-white/80">Poster image URL</span><input className={field} type="url" value={posterUrl} onChange={(e) => setPosterUrl(e.target.value)} /></label>
      <div className="flex gap-3">
        <button type="submit" className="min-h-11 rounded-xl px-4 bg-[#8b7ae0] font-semibold text-[#0b0b10]">Save</button>
        <button type="button" className="min-h-11 rounded-xl px-4 bg-white/10" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}
