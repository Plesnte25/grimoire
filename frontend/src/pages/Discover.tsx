import { useMemo, useState } from "react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { dismissSuggestion, fetchAccountPreferences, fetchSuggestions } from "../app/api";
import { useAppSearch } from "../components/AppShell";
import type { MediaType, SuggestionItem } from "../types";
import { showToast } from "../lib/toast";

const CATEGORIES: { type: MediaType; label: string }[] = [
  { type: "MOVIE", label: "Movies" },
  { type: "TV", label: "TV" },
  { type: "ANIME", label: "Anime" },
  { type: "BOOK", label: "Books" },
];

const keyFor = (item: SuggestionItem) => `${item.provider}:${item.providerId}`;

export function Discover() {
  const { openSearch } = useAppSearch();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();
  const { data: preferences } = useQuery({ queryKey: ["account-preferences"], queryFn: fetchAccountPreferences });
  const buckets = useQueries({
    queries: CATEGORIES.map(({ type }) => ({
      queryKey: ["suggestions", type],
      queryFn: () => fetchSuggestions(type),
      staleTime: 5 * 60_000,
    })),
  });
  const rows = useMemo(() => CATEGORIES.map(({ type, label }, index) => {
    const data = buckets[index]?.data?.byType[type];
    const source: "liked" | "trending" = data?.becauseYouLike.length ? "liked" : "trending";
    const values = data?.quickPicks ?? [];
    return {
      type,
      label,
      source,
      items: values.filter((item) =>
        item.mediaType === type &&
        (!item.isAdult || preferences?.showAdultContent) &&
        !dismissed.has(keyFor(item))
      ).slice(0, 10),
      loading: buckets[index]?.isLoading ?? true,
      error: buckets[index]?.isError ?? false,
    };
  }), [buckets, dismissed, preferences?.showAdultContent]);

  async function dismiss(item: SuggestionItem) {
    const key = keyFor(item);
    setDismissed((current) => new Set(current).add(key));
    try {
      await dismissSuggestion(item.provider, item.providerId, item.mediaType);
      await queryClient.invalidateQueries({ queryKey: ["suggestions"] });
    } catch (error: any) {
      setDismissed((current) => {
      const next = new Set(current);
      next.delete(key);
      return next;
      });
      showToast({ message: error?.response?.data?.error ?? "Couldn’t dismiss this pick", timeoutMs: 6000 });
    }
  }

  return (
    <div className="mx-auto max-w-[1440px] px-5 pb-10 pt-20 md:px-10 md:pt-16">
      <header className="mb-10 border-b border-[var(--line)] pb-8">
        <p className="kicker">FOLLOW THE THREAD</p>
        <h1 className="font-display mt-2 text-5xl font-medium tracking-tight sm:text-6xl">Discover</h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-[var(--tx2)]">A few thoughtful next chapters, chosen from the things you already love.</p>
      </header>
      <div className="space-y-12">
        {rows.map((row) => (
          <section key={row.type} aria-labelledby={`discover-${row.type}`}>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="kicker">{row.source === "liked" ? "BECAUSE YOU LIKED SOMETHING" : "TRENDING IN YOUR TASTE"}</p>
                <h2 id={`discover-${row.type}`} className="font-display mt-1 text-3xl font-medium">{row.label}</h2>
              </div>
              <button type="button" onClick={() => openSearch({ mediaTypeFilter: row.type })} className="min-h-11 text-sm font-semibold text-[var(--acc)]">Search {row.label}</button>
            </div>
            {row.error ? <p role="alert" className="mt-4 text-sm text-[var(--err)]">Couldn't load {row.label.toLowerCase()} picks.</p> : null}
            {row.items.length ? (
              <div className="poster-grid mt-5">
                {row.items.map((item) => (
                  <article key={keyFor(item)} className="group relative min-w-0">
                    <button type="button" aria-label={`Add ${item.title} to library`} onClick={() => openSearch({ initialItem: item })} className="block w-full text-left">
                      <div className="aspect-[2/3] overflow-hidden rounded-[var(--radius-poster)] bg-[var(--s2)]">
                        {item.posterUrl ? <img src={item.posterUrl} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]" /> : <span className="flex h-full items-center justify-center p-3 text-center text-xs">{item.title}</span>}
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm font-semibold text-[var(--tx)]">{item.title}</p>
                      <p className="truncate text-xs text-[var(--tx3)]">{item.reason.type === "SEED_RECOMMENDATION" ? `Because you liked ${item.reason.seed.title}` : item.reason.genres.length ? `Trending in ${item.reason.genres.slice(0, 2).join(" · ")}` : item.year ?? "A pick for your shelves"}</p>
                    </button>
                    <button type="button" aria-label={`Dismiss ${item.title}`} onClick={() => dismiss(item)} className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-[var(--bg)]/85 text-[var(--tx)] opacity-100 shadow md:opacity-0 md:group-hover:opacity-100">×</button>
                  </article>
                ))}
              </div>
            ) : <p className="mt-4 text-sm text-[var(--tx3)]">{row.loading ? "Finding your next pick…" : "Add a few titles to your library for more tailored picks."}</p>}
          </section>
        ))}
      </div>
    </div>
  );
}
