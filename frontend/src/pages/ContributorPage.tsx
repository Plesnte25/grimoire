import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchContributor } from "../app/api";
import { CatalogCard, catalogGrid } from "../components/CatalogCard";
import { formatScore } from "../lib/ratings";
import { statusLabel } from "../lib/status";

const ROLE_LABEL: Record<string, string> = { DIRECTOR: "Director", CREATOR: "Creator", AUTHOR: "Author", CAST: "Cast", STUDIO: "Studio" };

export function ContributorPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [bioOpen, setBioOpen] = useState(false);
  const { data, isLoading, isError } = useQuery({ queryKey: ["contributor", id], queryFn: () => fetchContributor(id!) });

  if (isLoading) return <div className="mx-auto max-w-6xl px-5 py-12 text-sm text-[var(--tx3)]">Loading creator…</div>;
  if (isError || !data) return <div role="alert" className="mx-auto max-w-6xl px-5 py-12 text-sm text-[var(--err)]">Couldn’t load this page. Try again.</div>;

  const { contributor, bio, yours, otherWork } = data;
  const rated = yours.filter((y) => y.yourRating != null);
  const avg = rated.length ? rated.reduce((n, y) => n + (y.yourRating ?? 0), 0) / rated.length : null;

  return (
    <div className="min-h-screen px-4 md:px-8 py-6 max-w-6xl mx-auto">
      <button className="min-h-11 text-sm text-[var(--tx2)] hover:text-[var(--tx)]" onClick={() => nav(-1)}>
        ← Back
      </button>
      <div className="mt-2 flex items-center gap-4">
        {contributor.imageUrl ? (
          <img src={contributor.imageUrl} alt="" className="h-24 w-24 rounded-full object-cover" />
        ) : (
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white/10 text-3xl font-semibold" aria-hidden="true">
            {contributor.name.slice(0, 1)}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-medium sm:text-3xl">{contributor.name}</h1>
          <p className="text-sm text-[var(--tx2)]">
            {contributor.kind === "STUDIO" ? "Studio" : "Person"} · {yours.length} in your library
            {avg != null ? ` · you average ${formatScore(avg)}` : ""}
          </p>
        </div>
      </div>

      {bio ? (
        <div className="mt-4 max-w-3xl text-sm leading-relaxed text-white/85">
          <p className={bioOpen ? "whitespace-pre-line" : "line-clamp-3"}>{bio}</p>
          <button className="min-h-11 text-sm underline underline-offset-2" onClick={() => setBioOpen(!bioOpen)}>
            {bioOpen ? "Less" : "More"}
          </button>
        </div>
      ) : null}

      <section className="mt-9 border-t border-[var(--line)] pt-5" aria-labelledby="yours-heading">
        <h2 id="yours-heading" className="font-display text-xl font-medium">In your library</h2>
        <ul className={`mt-3 ${catalogGrid}`}>
          {yours.map((y) => (
            <li key={`${y.id}-${y.role}`} className="surface-card flex flex-col rounded-[var(--radius-card)] bg-[var(--youbg)] p-2">
              <button className="aspect-[2/3] overflow-hidden rounded-lg bg-white/5" onClick={() => nav(`/media/${y.id}`)} aria-label={`Open ${y.title}`}>
                {y.posterUrl ? <img src={y.posterUrl} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
              </button>
              <div className="mt-2 line-clamp-2 text-sm font-semibold">{y.title}</div>
              <div className="text-xs text-[var(--tx3)]">
                {[ROLE_LABEL[y.role] ?? y.role, y.character ? `as ${y.character}` : null, y.year].filter(Boolean).join(" · ")}
              </div>
              <div className="mt-auto pt-2 text-xs text-[var(--tx2)]">
                {statusLabel(y.status, y.mediaType)}
                {y.yourRating != null ? ` · You ${formatScore(y.yourRating)}` : ""}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {otherWork.length ? (
        <section className="mt-9 border-t border-[var(--line)] pt-5" aria-labelledby="other-heading">
          <h2 id="other-heading" className="font-display text-xl font-medium">More of their work</h2>
          <ul className={`mt-3 ${catalogGrid}`}>
            {otherWork.map((w) => (
              <CatalogCard key={`${w.mediaType}-${w.providerId}`} entry={w} subtitle={w.role} invalidate={["contributor", id]} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
