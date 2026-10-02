import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchSharedList } from "../app/api";
import { plainText } from "../lib/text";

export function SharedListPage() {
  const { token } = useParams();
  const { data: list, isLoading, isError } = useQuery({
    queryKey: ["shared-list", token],
    queryFn: () => fetchSharedList(token!),
    enabled: !!token,
    retry: false,
  });

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-5 py-8 md:px-10 md:py-12">
      <Link to="/" className="min-h-11 inline-flex items-center text-sm text-[var(--acc)] no-underline">Grimoire</Link>
      {isLoading ? <p className="mt-8 text-sm text-[var(--tx3)]">Opening shared list…</p> : null}
      {isError ? (
        <section className="surface-card mt-8 rounded-[var(--radius-panel)] p-6">
          <h1 className="font-display text-2xl">This shared list isn’t available</h1>
          <p className="mt-2 text-sm text-[var(--tx3)]">The link may have expired or been revoked.</p>
        </section>
      ) : null}
      {list ? (
        <>
          <header className="mt-7 border-b border-[var(--line)] pb-6">
            <p className="text-sm text-[var(--tx3)]">A list shared from Grimoire</p>
            <h1 className="font-display mt-1 text-4xl font-medium">{list.name}</h1>
            {list.description ? <p className="mt-3 max-w-2xl whitespace-pre-line text-sm leading-relaxed text-[var(--tx2)]">{plainText(list.description)}</p> : null}
            <p className="mt-3 text-xs text-[var(--tx3)]">{list.items.length} title{list.items.length === 1 ? "" : "s"}</p>
          </header>
          {list.items.length ? (
            <ol className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {list.items.map((entry, index) => (
                <li key={`${entry.order}-${entry.media.title}`} className="surface-card min-w-0 overflow-hidden rounded-[var(--radius-card)]">
                  <div className="relative aspect-[2/3] bg-[var(--s2)]">
                    {entry.media.posterUrl ? <img src={entry.media.posterUrl} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
                    {list.isRanked ? <span className="absolute left-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-[var(--bg)] text-xs font-semibold">{index + 1}</span> : null}
                  </div>
                  <div className="p-3">
                    <h2 className="line-clamp-2 text-sm font-semibold">{entry.media.title}</h2>
                    <p className="mt-1 text-xs text-[var(--tx3)]">{entry.media.year ?? entry.media.mediaType}</p>
                  </div>
                </li>
              ))}
            </ol>
          ) : <p className="mt-6 text-sm text-[var(--tx3)]">This list is empty.</p>}
        </>
      ) : null}
    </main>
  );
}
