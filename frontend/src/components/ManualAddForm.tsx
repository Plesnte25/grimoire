import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { AccountPreferences, MediaType } from "../types";
import { addToLibrary } from "../app/api";
import { countryFlag, countryName } from "../lib/regions";
import { showToast } from "../lib/toast";
import { RatingInput } from "./RatingInput";

// Countries offered first; any other ISO code can be typed.
const COMMON_COUNTRIES = ["PK", "TR", "KR", "IN", "JP", "CN", "US", "GB", "NO", "DE", "FR", "ES", "IT", "SE", "DK"];

const field = "w-full min-h-11 rounded-xl bg-black/30 border border-white/15 px-3 text-sm";

/** For titles no provider has (obscure regional dramas): KNOWN_ISSUES #38. */
export function ManualAddForm({
  defaultType,
  defaultCountry,
  defaultTitle,
  defaultStatus = "PLANNED",
  onCancel,
  onAdded,
}: {
  defaultType: MediaType;
  defaultCountry: string;
  defaultTitle: string;
  defaultStatus?: AccountPreferences["defaultMediaStatus"];
  onCancel: () => void;
  onAdded: (id: string) => void;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(defaultTitle);
  const [mediaType, setMediaType] = useState<MediaType>(defaultType);
  const [country, setCountry] = useState(defaultCountry);
  const [year, setYear] = useState("");
  const [episodes, setEpisodes] = useState("");
  const [posterUrl, setPosterUrl] = useState("");
  const [status, setStatus] = useState<AccountPreferences["defaultMediaStatus"]>(defaultStatus);
  const [rating, setRating] = useState<number | null>(null);
  const [progress, setProgress] = useState(1);
  const [regionOverride, setRegionOverride] = useState("");
  const [saving, setSaving] = useState(false);
  const series = mediaType === "TV" || mediaType === "ANIME";

  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!title.trim()) return;
        setSaving(true);
        try {
          const item = await addToLibrary({
            provider: "manual",
            providerId: "",
            mediaType,
            title: title.trim(),
            status,
            yourRating: status === "COMPLETED" ? rating : null,
            progressValue: status === "IN_PROGRESS" ? progress : 0,
            progressText: status === "IN_PROGRESS" ? `${progress}` : undefined,
            year: year ? Number(year) : undefined,
            posterUrl: /^https?:\/\//.test(posterUrl) ? posterUrl : undefined,
            countryOfOrigin: /^[A-Za-z]{2}$/.test(country) ? country.toUpperCase() : undefined,
            episodes: series && episodes ? Number(episodes) : undefined,
            regionOverride: regionOverride || undefined,
          });
          qc.invalidateQueries({ queryKey: ["library"] });
          onAdded(item.id);
        } catch (err: any) {
          showToast({ message: err?.response?.data?.error ?? "Couldn't add it", timeoutMs: 6000 });
        } finally {
          setSaving(false);
        }
      }}
    >
      <h3 className="text-sm font-semibold">Add manually</h3>
      <p className="text-xs text-white/75">For titles that aren't on TMDB, AniList or Google Books. You can edit these details later.</p>
      <label className="block space-y-1 text-sm">
        <span className="text-white/80">Title</span>
        <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} required />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="text-white/80">Status</span>
          <select className={field} value={status} onChange={(event) => setStatus(event.target.value as AccountPreferences["defaultMediaStatus"])}>
            <option value="PLANNED">Planned</option><option value="IN_PROGRESS">Watching / reading</option><option value="COMPLETED">Completed</option><option value="DROPPED">Dropped</option>
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-white/80">Type</span>
          <select className={field} value={mediaType} onChange={(e) => setMediaType(e.target.value as MediaType)}>
            <option value="TV">TV show / drama</option>
            <option value="MOVIE">Movie</option>
            <option value="ANIME">Anime</option>
            <option value="BOOK">Book</option>
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-white/80">Country</span>
          <input className={field} list="manual-countries" placeholder="PK, TR, KR…" maxLength={2} value={country} onChange={(e) => setCountry(e.target.value.toUpperCase())} />
          <datalist id="manual-countries">
            {COMMON_COUNTRIES.map((c) => (
              <option key={c} value={c}>{`${countryFlag(c)} ${countryName(c)}`}</option>
            ))}
          </datalist>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-white/80">Year</span>
          <input className={field} inputMode="numeric" maxLength={4} value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, ""))} />
        </label>
        {series ? (
          <label className="space-y-1 text-sm">
            <span className="text-white/80">Episodes</span>
            <input className={field} inputMode="numeric" value={episodes} onChange={(e) => setEpisodes(e.target.value.replace(/\D/g, ""))} />
          </label>
        ) : null}
        {status === "IN_PROGRESS" ? (
          <label className="space-y-1 text-sm">
            <span className="text-white/80">Up to {mediaType === "BOOK" ? "page" : "episode"}</span>
            <input className={field} type="number" min="0" value={progress} onChange={(event) => setProgress(Math.max(0, Number(event.target.value)))} />
          </label>
        ) : null}
      </div>
      {(mediaType === "TV" || mediaType === "MOVIE") ? (
        <label className="block space-y-1 text-sm">
          <span className="text-white/80">Region</span>
          <select className={field} value={regionOverride} onChange={(event) => setRegionOverride(event.target.value)}>
            <option value="">Automatic from country</option><option value="NONE">General</option>
            <option value="TR">Turkish</option><option value="PK">Pakistani</option><option value="KR">Korean</option><option value="EU">European</option>
          </select>
        </label>
      ) : null}
      {status === "COMPLETED" ? <div><p className="mb-1 text-sm text-white/80">Your rating</p><RatingInput value={rating} onChange={setRating} /></div> : null}
      <label className="block space-y-1 text-sm">
        <span className="text-white/80">Poster image URL (optional)</span>
        <input className={field} type="url" placeholder="https://…" value={posterUrl} onChange={(e) => setPosterUrl(e.target.value)} />
      </label>
      <div className="flex gap-3">
        <button type="submit" disabled={saving || !title.trim()} className="min-h-11 rounded-xl px-4 bg-[var(--acc)] font-semibold text-[var(--bg)] disabled:opacity-50">
          {saving ? "Adding…" : "Add"}
        </button>
        <button type="button" className="min-h-11 rounded-xl px-4 bg-white/10" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
