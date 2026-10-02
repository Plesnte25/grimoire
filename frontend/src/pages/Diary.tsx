import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchDiary } from "../app/api";
import type { DiaryLog } from "../types";
import { formatScore } from "../lib/ratings";

const STEPS = ["var(--heat-1)", "var(--heat-2)", "var(--heat-3)", "var(--heat-4)"];
const EMPTY = "color-mix(in srgb, var(--tx) 7%, transparent)";
const TYPE_LABEL = { MOVIE: "Movie", TV: "TV", ANIME: "Anime", BOOK: "Book" } as const;

function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function longDay(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

/** Weeks (columns) of 7 days (Mon..Sun) covering the year; null = outside it. */
function yearGrid(year: number): (string | null)[][] {
  const first = new Date(year, 0, 1);
  const offset = (first.getDay() + 6) % 7; // Monday-based
  const days: (string | null)[] = Array(offset).fill(null);
  for (let d = new Date(first); d.getFullYear() === year; d.setDate(d.getDate() + 1)) days.push(dayKey(d));
  while (days.length % 7) days.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks;
}

function Heatmap({
  year,
  byDay,
  selected,
  onSelect,
}: {
  year: number;
  byDay: Map<string, DiaryLog[]>;
  selected: string | null;
  onSelect: (day: string | null) => void;
}) {
  const weeks = useMemo(() => yearGrid(year), [year]);
  const [tip, setTip] = useState<{ day: string; x: number; y: number } | null>(null);

  const months = weeks.map((w, i) => {
    const firstOfMonth = w.find((d) => d?.endsWith("-01"));
    return firstOfMonth && i > 0
      ? new Date(year, Number(firstOfMonth.slice(5, 7)) - 1, 1).toLocaleDateString(undefined, { month: "short" })
      : i === 0
        ? new Date(year, 0, 1).toLocaleDateString(undefined, { month: "short" })
        : "";
  });

  const showTip = (day: string, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    setTip({ day, x: r.left + r.width / 2, y: r.top });
  };

  return (
    <div className="relative">
      <div className="overflow-x-auto pb-2" role="group" aria-label={`Finished per day in ${year}`}>
        <div className="inline-grid gap-[2px]" style={{ gridTemplateColumns: `repeat(${weeks.length}, 12px)` }}>
          {months.map((m, i) => (
            <div key={`m${i}`} className="h-4 overflow-visible whitespace-nowrap text-[10px] text-white/75" aria-hidden="true">{m}</div>
          ))}
          {Array.from({ length: 7 }, (_, row) =>
            weeks.map((week, col) => {
              const day = week[row];
              if (!day) return <div key={`${col}-${row}`} className="h-3 w-3" aria-hidden="true" />;
              const n = byDay.get(day)?.length ?? 0;
              const color = n === 0 ? EMPTY : STEPS[Math.min(n, 4) - 1];
              const label = `${n} finished · ${longDay(day)}`;
              return (
                <button
                  key={day}
                  type="button"
                  aria-label={label}
                  aria-pressed={selected === day}
                  className={`h-3 w-3 rounded-[3px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white ${
                    selected === day ? "outline outline-2 outline-white" : "hover:brightness-125"
                  }`}
                  style={{ background: color, gridColumn: col + 1, gridRow: row + 2 }}
                  onPointerEnter={(e) => showTip(day, e.currentTarget)}
                  onPointerLeave={() => setTip(null)}
                  onFocus={(e) => showTip(day, e.currentTarget)}
                  onBlur={() => setTip(null)}
                  onClick={() => onSelect(selected === day ? null : day)}
                />
              );
            })
          )}
        </div>
      </div>
      {tip ? (
        <div
          role="tooltip"
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-lg border border-white/15 bg-[#0b0b10] px-2.5 py-1.5 text-xs shadow-xl"
          style={{ left: tip.x, top: tip.y - 6 }}
        >
          <span className="font-semibold text-white">{byDay.get(tip.day)?.length ?? 0} finished</span>{" "}
          <span className="text-white/75">· {longDay(tip.day)}</span>
        </div>
      ) : null}
      <div className="mt-2 flex items-center gap-1.5 text-xs text-white/75" aria-hidden="true">
        <span>Less</span>
        <span className="h-3 w-3 rounded-[3px]" style={{ background: EMPTY }} title="0" />
        {STEPS.map((c, i) => (
          <span key={c} className="flex items-center gap-1">
            <span className="h-3 w-3 rounded-[3px]" style={{ background: c }} />
            <span>{i === 3 ? "4+" : i + 1}</span>
          </span>
        ))}
        <span>More</span>
      </div>
    </div>
  );
}

export function Diary() {
  const nav = useNavigate();
  const [year, setYear] = useState(new Date().getFullYear());
  const [selected, setSelected] = useState<string | null>(null);
  const { data: logs = [], isLoading } = useQuery({ queryKey: ["diary", year], queryFn: () => fetchDiary(year) });

  const byDay = useMemo(() => {
    const m = new Map<string, DiaryLog[]>();
    for (const log of logs) {
      if (!log.finishedAt) continue;
      const key = dayKey(new Date(log.finishedAt));
      m.set(key, [...(m.get(key) ?? []), log]);
    }
    return m;
  }, [logs]);

  const days = [...byDay.keys()].filter((d) => !selected || d === selected).sort().reverse();

  return (
    <div className="min-h-screen px-4 md:px-8 py-6 max-w-5xl mx-auto space-y-6">
      <button className="min-h-11 text-sm text-white/80 hover:text-white" onClick={() => nav(-1)}>
        ← Back
      </button>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-medium">Diary</h1>
          <p className="mt-1 text-sm text-[var(--tx3)]">
            <span className="text-3xl font-semibold text-white tabular-nums">{logs.length}</span> finished in {year}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="min-h-11 min-w-11 rounded-xl bg-white/10 hover:bg-white/15" aria-label="Previous year" onClick={() => { setYear(year - 1); setSelected(null); }}>←</button>
          <span className="w-14 text-center tabular-nums">{year}</span>
          <button
            className="min-h-11 min-w-11 rounded-xl bg-white/10 hover:bg-white/15 disabled:opacity-30"
            aria-label="Next year"
            disabled={year >= new Date().getFullYear()}
            onClick={() => { setYear(year + 1); setSelected(null); }}
          >
            →
          </button>
        </div>
      </div>

      <div className="surface-card rounded-[var(--radius-panel)] p-4">
        <Heatmap year={year} byDay={byDay} selected={selected} onSelect={setSelected} />
      </div>

      <section aria-labelledby="entries-heading" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 id="entries-heading" className="text-lg font-semibold">
            {selected ? longDay(selected) : "All entries"}
          </h2>
          {selected ? (
            <button className="min-h-11 text-sm underline" onClick={() => setSelected(null)}>Show all</button>
          ) : null}
        </div>
        {isLoading ? <p className="text-sm text-white/75">Loading…</p> : null}
        {!isLoading && days.length === 0 ? (
          <p className="text-sm text-white/75">
            Nothing finished {selected ? "that day" : `in ${year}`} yet. Marking something completed adds it here.
          </p>
        ) : null}
        {days.map((day) => (
          <div key={day}>
            <h3 className="text-sm text-white/75">{longDay(day)}</h3>
            <ul className="mt-2 space-y-2">
              {byDay.get(day)!.map((log) => (
                <li key={log.id}>
                  <button
                    className="surface-card flex w-full items-center gap-3 rounded-[var(--radius-card)] p-2 text-left transition-colors hover:bg-[var(--s2)]"
                    onClick={() => nav(`/media/${log.media.id}`)}
                  >
                    <span className="h-14 w-10 shrink-0 overflow-hidden rounded-md bg-white/5">
                      {log.media.posterUrl ? <img src={log.media.posterUrl} alt="" className="h-full w-full object-cover" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{log.media.title}</span>
                      <span className="block text-xs text-white/75">
                        {TYPE_LABEL[log.media.mediaType]}
                        {log.isRewatch ? ` · ${log.media.mediaType === "BOOK" ? "Re-read" : "Rewatch"}` : ""}
                        {log.rating != null ? ` · Rated ${formatScore(log.rating)}` : ""}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}
