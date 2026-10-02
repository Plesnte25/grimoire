import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchYearStats } from "../app/api";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DONUT_COLORS = ["var(--acc)", "var(--you)", "var(--ok)", "var(--warn)", "var(--tx3)"];

function Donut({ values }: { values: { country: string; count: number }[] }) {
  const total = values.reduce((sum, item) => sum + item.count, 0);
  let cursor = 0;
  const stops = values.slice(0, 5).map((item, index) => {
    const start = cursor;
    cursor += total ? item.count / total * 100 : 0;
    return `${DONUT_COLORS[index % DONUT_COLORS.length]} ${start}% ${cursor}%`;
  });
  return (
    <div className="flex flex-wrap items-center gap-5">
      <div
        role="img"
        aria-label={`Titles by origin country; ${total} titles total`}
        className="h-36 w-36 shrink-0 rounded-full"
        style={{ background: stops.length ? `conic-gradient(${stops.join(", ")})` : "var(--s2)" }}
      >
        <div className="m-auto mt-8 grid h-20 w-20 place-items-center rounded-full bg-[var(--s1)] text-center">
          <span><strong className="block font-display text-2xl tabular-nums">{total}</strong><span className="text-[10px] text-[var(--tx3)]">titles</span></span>
        </div>
      </div>
      <ul className="min-w-[12rem] flex-1 space-y-2">
        {values.slice(0, 5).map((value, index) => (
          <li key={value.country} className="flex items-center gap-2 text-sm">
            <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: DONUT_COLORS[index % DONUT_COLORS.length] }} />
            <span className="min-w-0 flex-1 truncate">{value.country}</span>
            <span className="tabular-nums text-[var(--tx3)]">{value.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Stats() {
  const [year, setYear] = useState(new Date().getFullYear());
  const { data, isLoading, isError } = useQuery({
    queryKey: ["stats", year],
    queryFn: () => fetchYearStats(year),
  });
  const highestMonth = Math.max(1, ...(data?.monthly ?? []));
  const highestRating = Math.max(1, ...(data?.ratingDistribution.map((entry) => entry.count) ?? []));

  return (
    <div className="mx-auto max-w-[1120px] space-y-8 px-5 py-8 md:px-10 md:py-10">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--line)] pb-6">
        <div>
          <p className="text-sm text-[var(--tx3)]">Your year, in stories</p>
          <h1 className="font-display mt-1 text-4xl font-medium">Grimoire Wrapped</h1>
        </div>
        <label className="grid gap-1 text-xs font-medium text-[var(--tx3)]">
          Year
          <select className="min-h-11 rounded-xl border border-[var(--line2)] bg-[var(--s1)] px-3 text-sm text-[var(--tx)]" value={year} onChange={(event) => setYear(Number(event.target.value))}>
            {Array.from({ length: 7 }, (_, index) => new Date().getFullYear() - index).map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
      </header>

      {isLoading ? <p className="text-sm text-[var(--tx3)]">Gathering your year…</p> : null}
      {isError ? <p role="alert" className="text-sm text-[var(--err)]">Couldn’t load your yearly stats.</p> : null}
      {data ? (
        <>
          <section aria-label={`${year} summary`} className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-panel)] border border-[var(--line)] bg-[var(--line)] md:grid-cols-4">
            {[
              ["Titles finished", data.completedTitleCount],
              ["Log entries", data.finishedLogCount],
              ["Your average", data.averagePersonalRating?.toFixed(1) ?? "—"],
              ["Provider average", data.averageProviderRating?.toFixed(1) ?? "—"],
            ].map(([label, value]) => (
              <div key={String(label)} className="bg-[var(--s1)] p-4 md:p-5">
                <p className="font-display text-3xl tabular-nums">{value}</p>
                <p className="mt-1 text-xs text-[var(--tx3)]">{label}</p>
              </div>
            ))}
          </section>

          {data.averagePersonalRating != null || data.averageProviderRating != null ? (
            <p className="text-sm text-[var(--tx2)]">
              Average rating: <span className="font-semibold text-[var(--you)]">✦ {data.averagePersonalRating?.toFixed(1) ?? "—"}</span>
              {" "}vs provider average <span className="font-semibold">{data.averageProviderRating?.toFixed(1) ?? "—"}</span>
            </p>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="surface-card rounded-[var(--radius-panel)] p-4 md:p-5" aria-labelledby="monthly-heading">
              <h2 id="monthly-heading" className="font-display text-xl font-medium">Finished by month</h2>
              <div className="mt-5 grid h-44 grid-cols-12 items-end gap-2" role="img" aria-label={`Finished watch and read log entries by month for ${year}`}>
                {data.monthly.map((count, index) => (
                  <div key={MONTHS[index]} className="flex h-full min-w-0 flex-col items-center justify-end gap-2">
                    <span className="text-[10px] tabular-nums text-[var(--tx3)]">{count || ""}</span>
                    <div className="w-full rounded-t-sm bg-[var(--acc)]" style={{ height: `${count ? Math.max(6, count / highestMonth * 100) : 0}%` }} />
                    <span className="text-[9px] text-[var(--tx3)]">{MONTHS[index]}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="surface-card rounded-[var(--radius-panel)] p-4 md:p-5" aria-labelledby="rating-heading">
              <h2 id="rating-heading" className="font-display text-xl font-medium">Your ratings</h2>
              {data.ratingDistribution.length ? (
                <div className="mt-5 space-y-2">
                  {data.ratingDistribution.map(({ rating, count }) => (
                    <div key={rating} className="grid grid-cols-[2.5rem_minmax(0,1fr)_2rem] items-center gap-2 text-xs">
                      <span className="tabular-nums text-[var(--tx3)]">{rating}/10</span>
                      <div className="h-3 overflow-hidden rounded-full bg-[var(--s2)]">
                        <div className="h-full rounded-full bg-[var(--you)]" style={{ width: `${count / highestRating * 100}%` }} />
                      </div>
                      <span className="text-right tabular-nums">{count}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="mt-5 text-sm text-[var(--tx3)]">No ratings recorded in {year}.</p>}
            </section>
          </div>

          <section className="surface-card rounded-[var(--radius-panel)] p-4 md:p-5" aria-labelledby="country-heading">
            <h2 id="country-heading" className="font-display mb-5 text-xl font-medium">Titles by origin</h2>
            {data.countries.length ? <Donut values={data.countries} /> : <p className="text-sm text-[var(--tx3)]">Origin data isn’t available for this year yet.</p>}
          </section>
        </>
      ) : null}
    </div>
  );
}
