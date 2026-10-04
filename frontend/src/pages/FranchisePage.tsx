import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchAccountPreferences, fetchCollection, fetchFranchise, fetchItem } from "../app/api";
import type { CatalogEntry, ProviderSearchResult } from "../types";
import { CatalogCard, catalogGrid } from "../components/CatalogCard";
import { EpisodeGuide } from "../components/EpisodeGuide";
import { useAppSearch } from "../components/AppShell";

type Hub = {
  title: string;
  nativeTitle?: string | null;
  posterUrl?: string | null;
  bannerUrl?: string | null;
  overview?: string | null;
  countryOfOrigin?: string | null;
  entries: CatalogEntry[];
  collection: boolean;
};

const LANGUAGE: Record<string, string> = { JP: "ja", CN: "zh", TW: "zh", KR: "ko" };

export function FranchisePage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { openSearch } = useAppSearch();
  const [searchParams] = useSearchParams();
  const isCollection = searchParams.get("collection") === "1";
  const [selectedSeason, setSelectedSeason] = useState("");
  const { data: preferences } = useQuery({
    queryKey: ["account-preferences"],
    queryFn: fetchAccountPreferences,
  });
  const { data, isLoading, isError } = useQuery({
    queryKey: ["franchise-hub", isCollection ? "collection" : "anime", id],
    queryFn: async (): Promise<Hub> => {
      if (isCollection) {
        const collection = await fetchCollection(id!);
        return {
          title: collection.name,
          bannerUrl: collection.backdropUrl,
          overview: collection.overview,
          entries: collection.parts,
          collection: true,
        };
      }
      const result = await fetchFranchise(id!);
      return {
        title: result.franchise.title,
        nativeTitle: result.franchise.nativeTitle,
        posterUrl: result.franchise.posterUrl,
        bannerUrl: result.franchise.bannerUrl,
        countryOfOrigin: result.franchise.countryOfOrigin,
        entries: result.entries,
        collection: false,
      };
    },
    staleTime: 5 * 60_000,
  });
  const mainEntries = useMemo(() => (data?.entries ?? []).filter((entry) => entry.role === "MAIN"), [data?.entries]);
  const extras = useMemo(() => (data?.entries ?? []).filter((entry) => entry.role !== "MAIN"), [data?.entries]);
  const inProgress = mainEntries.find((entry) => entry.yourStatus === "IN_PROGRESS");
  const completed = [...mainEntries].reverse().find((entry) => entry.yourStatus === "COMPLETED");
  const primary = inProgress ?? completed ?? mainEntries.find((entry) => entry.libraryId) ?? mainEntries[0] ?? data?.entries[0];
  const trackedCount = (data?.entries ?? []).filter((entry) => entry.libraryId).length;
  const completedCount = mainEntries.filter((entry) => entry.yourStatus === "COMPLETED").length;
  const selectedEntry = mainEntries.find((entry) => entry.providerId === selectedSeason) ?? inProgress ?? mainEntries[0];
  const { data: selectedItem } = useQuery({
    queryKey: ["franchise-hub-item", selectedEntry?.libraryId],
    queryFn: () => fetchItem(selectedEntry!.libraryId!),
    enabled: !!selectedEntry?.libraryId,
  });
  useEffect(() => {
    if (!selectedSeason && mainEntries.length) {
      setSelectedSeason((inProgress ?? mainEntries[0]).providerId);
    }
  }, [mainEntries, inProgress, selectedSeason]);

  if (isLoading) return <div className="mx-auto max-w-6xl px-5 py-12 text-sm text-[var(--tx3)]">Opening the story hub…</div>;
  if (isError || !data) return <div role="alert" className="mx-auto max-w-6xl px-5 py-12 text-sm text-[var(--err)]">Couldn’t load this story hub. Try again.</div>;

  const primaryAction = () => {
    if (primary?.libraryId) nav(`/media/${primary.libraryId}`);
    else if (primary) {
      const initialItem: ProviderSearchResult = {
        provider: primary.provider,
        providerId: primary.providerId,
        mediaType: primary.mediaType,
        title: primary.title,
        year: primary.year ?? undefined,
        posterUrl: primary.posterUrl ?? undefined,
      };
      openSearch({ initialItem });
    }
  };
  const primaryLabel = inProgress
    ? `Continue${inProgress.progressSeason && inProgress.progressEpisode ? `: S${inProgress.progressSeason} E${inProgress.progressEpisode}` : inProgress.progressValue ? `: Episode ${inProgress.progressValue}` : ""}`
    : completed
      ? "Rewatch"
      : "Start";
  const yearProgress = data.collection
    ? `${trackedCount} of ${data.entries.length} films in your library`
    : `${completedCount} of ${mainEntries.length} seasons completed · ${trackedCount} of ${data.entries.length} works tracked`;

  return (
    <div className="mx-auto max-w-[1440px] px-5 pb-10 pt-20 md:px-10 md:pt-16">
      <button className="mb-3 min-h-11 text-sm text-[var(--tx2)] hover:text-[var(--tx)]" onClick={() => nav(-1)}>← Back</button>
      <header className="relative overflow-hidden rounded-[var(--radius-panel)] border border-[var(--line)] bg-[var(--s1)]">
        {data.bannerUrl ? <img src={data.bannerUrl} alt="" className="h-56 w-full object-cover opacity-70 md:h-80" /> : <div className="h-56 bg-gradient-to-br from-[var(--s2)] to-[var(--bg)] md:h-80" />}
        <div className="catalog-banner-shade absolute inset-0" />
        <div className="absolute inset-x-0 bottom-0 flex items-end gap-4 p-4 md:p-7">
          {data.posterUrl ? <img src={data.posterUrl} alt="" className="hidden h-36 w-24 rounded-lg object-cover shadow-xl sm:block" /> : null}
          <div className="min-w-0">
            <p className="kicker">{data.collection ? "THE COLLECTION" : "STORY HUB"}</p>
            <h1 className="font-display mt-1 text-4xl font-medium sm:text-5xl">{data.title}</h1>
            {data.nativeTitle ? <p lang={LANGUAGE[data.countryOfOrigin ?? ""] ?? undefined} className="mt-1 text-sm text-[var(--tx2)]">{data.nativeTitle}</p> : null}
            <p className="mt-2 text-sm text-[var(--tx2)]">{yearProgress}</p>
            {data.overview ? <p className="mt-2 line-clamp-2 max-w-3xl text-sm text-[var(--tx2)]">{data.overview}</p> : null}
          </div>
          {primary ? (
            <button type="button" onClick={primaryAction} className="ml-auto min-h-12 shrink-0 rounded-full bg-[var(--acc)] px-5 text-sm font-bold text-[var(--bg)]">
              {primaryLabel}
            </button>
          ) : null}
        </div>
      </header>

      {!data.collection && mainEntries.length ? (
        <section className="mt-8" aria-labelledby="season-heading">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><p className="kicker">PICK UP THE THREAD</p><h2 id="season-heading" className="font-display mt-1 text-3xl font-medium">Seasons</h2></div>
            <label className="flex min-h-11 items-center gap-2 text-sm text-[var(--tx2)]">
              <span className="sr-only">Choose a season</span>
              <select value={selectedEntry?.providerId ?? ""} onChange={(event) => setSelectedSeason(event.target.value)} className="min-h-11 max-w-[70vw] rounded-xl border border-[var(--line2)] bg-[var(--s1)] px-3 text-[var(--tx)]">
                {mainEntries.map((entry, index) => <option key={entry.providerId} value={entry.providerId}>{entry.title || `Season ${index + 1}`}{entry.libraryId ? ` · ${entry.yourStatus === "COMPLETED" ? "Completed" : entry.yourStatus === "IN_PROGRESS" ? "In progress" : "In library"}` : " · Not added"}</option>)}
              </select>
            </label>
          </div>
          {selectedEntry ? (
            <div className="mt-4 grid gap-4 md:grid-cols-[12rem_minmax(0,1fr)]">
              <CatalogCard entry={selectedEntry} subtitle={selectedEntry.format?.replace(/_/g, " ")} />
              {selectedItem ? (
                <details className="surface-card rounded-[var(--radius-card)] p-4">
                  <summary className="min-h-11 cursor-pointer text-sm font-semibold">Episodes for {selectedEntry.title}</summary>
                  <div className="mt-3"><EpisodeGuide item={selectedItem} shieldSpoilers={preferences?.spoilerShield ?? true} /></div>
                </details>
              ) : (
                <p className="self-center text-sm text-[var(--tx3)]">Add this season to your library to open its cached episode guide.</p>
              )}
            </div>
          ) : null}
        </section>
      ) : null}

      {extras.length ? (
        <section className="mt-10 border-t border-[var(--line)] pt-6" aria-labelledby="extras-heading">
          <p className="kicker">{data.collection ? "WATCH ORDER" : "BEYOND THE MAIN LINE"}</p>
          <h2 id="extras-heading" className="font-display mt-1 text-3xl font-medium">{data.collection ? "Movies & extras" : "Movies & extras"}</h2>
          <ul className={`mt-4 ${catalogGrid}`}>
            {extras.map((entry) => <CatalogCard key={`${entry.provider}:${entry.providerId}`} entry={entry} subtitle={entry.format?.replace(/_/g, " ") ?? entry.role} />)}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
