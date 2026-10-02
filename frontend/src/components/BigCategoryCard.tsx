import { useQuery } from "@tanstack/react-query";
import { fetchLibrary } from "../app/api";
import { REGION_LABEL, type CategoryKey } from "../lib/regions";

const LABEL: Record<CategoryKey, string> = {
  MOVIE: "Movies",
  TV: "TV",
  ANIME: "Anime",
  BOOK: "Books",
  ...REGION_LABEL,
};

export function BigCategoryCard({
  category,
  stats,
  onOpen,
}: {
  category: CategoryKey;
  stats: { total: number; inProgress: number };
  onOpen: () => void;
}) {
  const { data: items = [] } = useQuery({
    queryKey: ["library", category],
    queryFn: () => fetchLibrary(category),
    staleTime: 1000 * 60 * 2,
  });
  const poster = items.find((item) => item.posterUrl)?.posterUrl;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="surface-card group relative flex min-h-40 w-full flex-col justify-between overflow-hidden rounded-[var(--radius-card)] p-4 text-left transition-colors hover:bg-[var(--s2)] focus-visible:outline"
    >
      {poster ? (
        <img src={poster} alt="" className="absolute inset-0 h-full w-full object-cover opacity-20 transition-opacity group-hover:opacity-30" loading="lazy" />
      ) : null}
      <span className="relative font-display text-2xl font-medium">{LABEL[category]}</span>
      <span className="relative flex items-end justify-between gap-3">
        <span>
          <span className="block text-sm tabular-nums">{stats.total} titles</span>
          <span className="mt-1 block text-xs text-[var(--tx3)]">{stats.inProgress} in progress</span>
        </span>
        <span aria-hidden="true" className="text-[var(--acc)]">→</span>
      </span>
    </button>
  );
}
