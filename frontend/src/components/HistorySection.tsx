import { useState } from "react";
import type { MediaType, WatchLog } from "../types";
import { formatScore } from "../lib/ratings";

const MODE_LABEL = { ORIGINAL: "Original language", SUB: "Subtitled", DUB: "Dubbed" } as const;

function day(iso?: string | null) {
  return iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : null;
}

function Review({ log }: { log: WatchLog }) {
  const [revealed, setRevealed] = useState(false);
  if (!log.review) return null;
  if (log.reviewHasSpoilers && !revealed) {
    return (
      <button
        type="button"
        className="mt-2 min-h-11 rounded-xl border border-white/15 px-3 text-sm text-white/85 hover:bg-white/10"
        onClick={() => setRevealed(true)}
      >
        Review hidden: contains spoilers. Show it
      </button>
    );
  }
  return <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-white/90">{log.review}</p>;
}

export function HistorySection({
  logs,
  mediaType,
  onAdd,
  onEdit,
}: {
  logs: WatchLog[];
  mediaType: MediaType;
  onAdd: () => void;
  onEdit: (log: WatchLog) => void;
}) {
  const isBook = mediaType === "BOOK";
  return (
    <section aria-labelledby="history-heading" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="history-heading" className="text-sm font-semibold">History</h2>
        <button type="button" className="min-h-11 rounded-xl bg-white/10 px-4 text-sm hover:bg-white/15" onClick={onAdd}>
          {isBook ? "Log a read" : "Log a watch"}
        </button>
      </div>
      {logs.length === 0 ? (
        <p className="text-sm text-white/75">
          Nothing logged yet. Marking it {isBook ? "Read" : "Completed"} records one, or log it with dates here.
        </p>
      ) : (
        <ol className="space-y-3">
          {logs.map((log) => {
            const finished = day(log.finishedAt);
            const started = day(log.startedAt);
            const facts = [
              log.rating != null ? `Rated ${formatScore(log.rating)}` : null,
              log.isRewatch ? (isBook ? "Re-read" : "Rewatch") : null,
              log.watchedOn,
              log.watchMode ? MODE_LABEL[log.watchMode] : null,
              log.watchedWith ? `with ${log.watchedWith}` : null,
            ].filter(Boolean);
            return (
              <li key={log.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="text-sm">
                    <span className="font-semibold">
                      {finished ? `Finished ${finished}` : started ? "In progress" : "Logged"}
                    </span>
                    {started ? <span className="text-white/75"> · started {started}</span> : null}
                    {facts.length ? <div className="mt-1 text-white/80">{facts.join(" · ")}</div> : null}
                  </div>
                  <button
                    type="button"
                    className="min-h-11 rounded-xl px-3 text-sm underline underline-offset-2 hover:bg-white/10"
                    onClick={() => onEdit(log)}
                  >
                    Edit
                  </button>
                </div>
                <Review log={log} />
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
