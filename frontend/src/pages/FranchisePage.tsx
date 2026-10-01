import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchFranchise } from "../app/api";
import type { CatalogEntry } from "../types";
import { CatalogCard, catalogGrid } from "../components/CatalogCard";

const ANIME_LANG: Record<string, string> = { JP: "ja", CN: "zh", TW: "zh", KR: "ko" };

const SECTIONS: { title: string; roles: string[] }[] = [
  { title: "Seasons", roles: ["MAIN"] },
  { title: "Movies", roles: ["MOVIE"] },
  { title: "OVAs & ONAs", roles: ["OVA", "ONA"] },
  { title: "Specials", roles: ["SPECIAL"] },
];

export function FranchisePage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["franchise", id],
    queryFn: () => fetchFranchise(id!),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <div className="min-h-screen p-6">Loading the franchise… (first visit can take a few seconds)</div>;
  if (isError || !data) return <div className="min-h-screen p-6">Couldn't load this franchise.</div>;

  const { franchise, entries } = data;
  const seasons = entries.filter((e) => e.role === "MAIN");
  const seenSeasons = seasons.filter((e) => e.yourStatus === "COMPLETED").length;
  const tracked = entries.filter((e) => e.libraryId).length;

  return (
    <div className="min-h-screen px-4 md:px-8 py-6 max-w-6xl mx-auto">
      <button className="min-h-11 text-sm text-white/80 hover:text-white" onClick={() => nav(-1)}>
        ← Back
      </button>

      <div className="relative mt-2 overflow-hidden rounded-2xl">
        {franchise.bannerUrl ? (
          <img src={franchise.bannerUrl} alt="" className="h-44 w-full object-cover opacity-70 md:h-56" />
        ) : (
          <div className="h-44 w-full bg-white/5 md:h-56" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b10] via-black/40 to-transparent" />
        <div className="absolute bottom-0 left-0 flex items-end gap-4 p-4">
          {franchise.posterUrl ? <img src={franchise.posterUrl} alt="" className="h-28 w-20 rounded-xl object-cover" /> : null}
          <div>
            <h1 className="text-2xl font-semibold">{franchise.title}</h1>
            {franchise.nativeTitle && franchise.nativeTitle.toLowerCase() !== franchise.title.toLowerCase() ? (
              <div className="text-sm text-white/80" lang={ANIME_LANG[franchise.countryOfOrigin ?? ""] ?? undefined}>
                {franchise.nativeTitle}
              </div>
            ) : null}
            <p className="mt-1 text-sm text-white/85">
              {seasons.length ? `${seenSeasons} of ${seasons.length} season${seasons.length === 1 ? "" : "s"} completed · ` : ""}
              {tracked} of {entries.length} entries in your library
            </p>
          </div>
        </div>
      </div>

      {SECTIONS.map(({ title, roles }) => {
        const list: CatalogEntry[] = entries.filter((e) => roles.includes(e.role ?? ""));
        if (!list.length) return null;
        return (
          <section key={title} className="mt-8" aria-labelledby={`sec-${title}`}>
            <h2 id={`sec-${title}`} className="text-lg font-semibold">
              {title} <span className="text-sm font-normal text-white/70">{list.filter((e) => e.libraryId).length}/{list.length}</span>
            </h2>
            <ul className={`mt-3 ${catalogGrid}`}>
              {list.map((e) => (
                <CatalogCard key={e.providerId} entry={e} subtitle={e.format?.replace("_", " ")} invalidate={["franchise", id]} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
