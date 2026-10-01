import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchCollection } from "../app/api";
import { CatalogCard, catalogGrid } from "../components/CatalogCard";
import { plainText } from "../lib/text";

export function CollectionPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { data, isLoading, isError } = useQuery({ queryKey: ["collection", id], queryFn: () => fetchCollection(id!) });

  if (isLoading) return <div className="min-h-screen p-6">Loading…</div>;
  if (isError || !data) return <div className="min-h-screen p-6">Couldn't load this collection.</div>;

  const seen = data.parts.filter((p) => p.libraryId).length;
  return (
    <div className="min-h-screen px-4 md:px-8 py-6 max-w-6xl mx-auto">
      <button className="min-h-11 text-sm text-white/80 hover:text-white" onClick={() => nav(-1)}>
        ← Back
      </button>
      <div className="relative mt-2 overflow-hidden rounded-2xl">
        {data.backdropUrl ? <img src={data.backdropUrl} alt="" className="h-44 w-full object-cover opacity-70 md:h-56" /> : <div className="h-44 w-full bg-white/5 md:h-56" />}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b10] via-black/40 to-transparent" />
        <div className="absolute bottom-0 left-0 p-4">
          <h1 className="text-2xl font-semibold">{data.name}</h1>
          <p className="mt-1 text-sm text-white/85">{seen} of {data.parts.length} films in your library</p>
        </div>
      </div>
      {data.overview ? <p className="mt-4 max-w-3xl text-sm leading-relaxed text-white/85">{plainText(data.overview)}</p> : null}
      <ul className={`mt-6 ${catalogGrid}`}>
        {data.parts.map((p, i) => (
          <CatalogCard key={p.providerId} entry={p} subtitle={`#${i + 1}`} invalidate={["collection", id]} />
        ))}
      </ul>
    </div>
  );
}
