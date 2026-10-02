import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchTrailers, fetchWatchProviders } from "../app/api";
import type { MediaItem } from "../types";

export function WhereToWatch({ item, country }: { item: MediaItem; country: string | null }) {
  const supported = item.mediaType === "MOVIE" || item.mediaType === "TV" || item.mediaType === "ANIME";
  const watch = useQuery({
    queryKey: ["watch-providers", item.id, country],
    queryFn: () => fetchWatchProviders(item.id, country!),
    enabled: supported && !!country,
    staleTime: 12 * 60 * 60 * 1000,
  });
  const trailers = useQuery({
    queryKey: ["trailers", item.id],
    queryFn: () => fetchTrailers(item.id),
    enabled: supported,
    staleTime: 12 * 60 * 60 * 1000,
  });

  if (!supported) return null;
  return (
    <section className="space-y-4 border-t border-[var(--line)] pt-5" aria-labelledby="where-heading">
      <div>
        <h2 id="where-heading" className="font-display text-xl font-medium">Watch & preview</h2>
        {country ? (
          <p className="mt-1 text-sm text-[var(--tx3)]">Availability for {country}</p>
        ) : (
          <p className="mt-1 text-sm text-[var(--tx3)]">
            <Link to="/settings" className="text-[var(--acc)] underline underline-offset-2">Choose your country</Link> to see where it streams.
          </p>
        )}
      </div>

      {country && watch.isLoading ? <p className="text-sm text-[var(--tx3)]">Checking availability…</p> : null}
      {watch.isError ? <p role="alert" className="text-sm text-[var(--err)]">Couldn’t load streaming availability.</p> : null}
      {country && !watch.isLoading && !watch.isError && !watch.data?.providers.length ? (
        <p className="text-sm text-[var(--tx3)]">
          {watch.data?.available ? "No streaming providers are listed for this country." : "Provider availability isn’t available for this title."}
        </p>
      ) : null}
      {watch.data?.providers.length ? (
        <div className="flex flex-wrap items-center gap-2">
          {watch.data.providers.map((provider, index) => (
            <span key={`${provider.id}-${provider.availability}-${index}`} className="surface-raised inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm">
              {provider.logoUrl ? <img src={provider.logoUrl} alt="" className="h-6 w-6 rounded-md object-cover" loading="lazy" /> : null}
              {provider.name}
              <span className="text-xs text-[var(--tx3)]">
                {provider.availability === "flatrate" ? "Stream" : provider.availability === "rent" ? "Rent" : "Buy"}
              </span>
            </span>
          ))}
          {watch.data.link ? <a className="min-h-11 inline-flex items-center px-2 text-sm text-[var(--acc)] underline underline-offset-2" href={watch.data.link} target="_blank" rel="noreferrer">All options ↗</a> : null}
        </div>
      ) : null}

      {trailers.isError ? <p role="alert" className="text-sm text-[var(--err)]">Couldn’t load trailers.</p> : null}
      {trailers.data?.trailers.length ? (
        <ul className="flex flex-wrap gap-2">
          {trailers.data.trailers.map((trailer) => (
            <li key={trailer.id}>
              <a className="min-h-11 inline-flex items-center rounded-xl border border-[var(--line2)] px-3 text-sm text-[var(--tx2)] hover:bg-[var(--s2)]" href={trailer.url} target="_blank" rel="noreferrer">
                {trailer.type}: {trailer.name}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
