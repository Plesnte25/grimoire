import { useEffect, useRef, useState } from "react";
import type { MediaType, WatchLog, WatchMode } from "../types";
import type { LogInput } from "../app/api";
import { RatingInput } from "./RatingInput";

const WHERE_SUGGESTIONS = ["Cinema", "Netflix", "Prime Video", "Disney+", "YouTube", "Crunchyroll", "TV", "Blu-ray / DVD", "Paperback", "E-book", "Audiobook"];

const field =
  "w-full rounded-xl bg-black/30 border border-white/15 px-3 min-h-11 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-white";

/** yyyy-mm-dd in local time, for <input type="date">. */
function toDateInput(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Midday UTC so the calendar day survives any timezone. */
function fromDateInput(v: string): string | null {
  return v ? `${v}T12:00:00.000Z` : null;
}

export function LogDialog({
  open,
  title,
  mediaType,
  log,
  onSave,
  onDelete,
  onClose,
}: {
  open: boolean;
  title: string;
  mediaType: MediaType;
  log?: WatchLog | null;
  onSave: (input: LogInput) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const isBook = mediaType === "BOOK";
  const today = toDateInput(new Date().toISOString());

  const [startedAt, setStartedAt] = useState("");
  const [finishedAt, setFinishedAt] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [review, setReview] = useState("");
  const [spoilers, setSpoilers] = useState(false);
  const [rewatch, setRewatch] = useState(false);
  const [watchedOn, setWatchedOn] = useState("");
  const [watchMode, setWatchMode] = useState<WatchMode | "">("");
  const [watchedWith, setWatchedWith] = useState("");

  useEffect(() => {
    if (!open) return;
    setStartedAt(toDateInput(log?.startedAt));
    setFinishedAt(log ? toDateInput(log.finishedAt) : today);
    setRating(log?.rating ?? null);
    setReview(log?.review ?? "");
    setSpoilers(log?.reviewHasSpoilers ?? false);
    setRewatch(log?.isRewatch ?? false);
    setWatchedOn(log?.watchedOn ?? "");
    setWatchMode(log?.watchMode ?? "");
    setWatchedWith(log?.watchedWith ?? "");
  }, [open, log, today]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="w-[min(94vw,560px)] max-h-[90vh] rounded-2xl border border-white/15 bg-[#1c1730] p-0 text-white backdrop:bg-black/60"
    >
      <form
        className="space-y-4 p-6"
        onSubmit={(e) => {
          e.preventDefault();
          onSave({
            startedAt: fromDateInput(startedAt),
            finishedAt: fromDateInput(finishedAt),
            rating,
            review,
            reviewHasSpoilers: spoilers,
            isRewatch: rewatch,
            watchedOn,
            watchMode: watchMode || null,
            watchedWith,
          });
        }}
      >
        <h2 className="text-lg font-semibold">{title}</h2>

        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1 text-sm">
            <span className="text-white/80">Started</span>
            <input type="date" className={field} value={startedAt} max={today} onChange={(e) => setStartedAt(e.target.value)} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-white/80">Finished</span>
            <input type="date" className={field} value={finishedAt} max={today} onChange={(e) => setFinishedAt(e.target.value)} />
          </label>
        </div>

        <div className="space-y-1 text-sm">
          <span className="text-white/80">Rating for this {isBook ? "read" : "watch"}</span>
          <RatingInput value={rating} onChange={setRating} label={`Rating for this ${isBook ? "read" : "watch"}`} />
        </div>

        <label className="block space-y-1 text-sm">
          <span className="text-white/80">Review</span>
          <textarea className={`${field} min-h-28 py-2`} value={review} onChange={(e) => setReview(e.target.value)} />
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" className="h-5 w-5" checked={spoilers} onChange={(e) => setSpoilers(e.target.checked)} />
          The review contains spoilers
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-white/80">Where</span>
            <input className={field} list="log-where" value={watchedOn} onChange={(e) => setWatchedOn(e.target.value)} />
            <datalist id="log-where">
              {WHERE_SUGGESTIONS.map((w) => <option key={w} value={w} />)}
            </datalist>
          </label>
          {!isBook ? (
            <label className="space-y-1 text-sm">
              <span className="text-white/80">How</span>
              <select className={field} value={watchMode} onChange={(e) => setWatchMode(e.target.value as WatchMode | "")}>
                <option value="">Not set</option>
                <option value="ORIGINAL">Original language</option>
                <option value="SUB">Subtitled</option>
                <option value="DUB">Dubbed</option>
              </select>
            </label>
          ) : null}
          <label className="space-y-1 text-sm sm:col-span-2">
            <span className="text-white/80">With</span>
            <input className={field} placeholder="Alone, family, friends…" value={watchedWith} onChange={(e) => setWatchedWith(e.target.value)} />
          </label>
        </div>

        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" className="h-5 w-5" checked={rewatch} onChange={(e) => setRewatch(e.target.checked)} />
          {isBook ? "Re-read" : "Rewatch"}
        </label>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          {onDelete ? (
            <button type="button" className="min-h-11 rounded-xl px-3 text-sm text-rose-300 hover:bg-rose-500/10" onClick={onDelete}>
              Delete this entry
            </button>
          ) : <span />}
          <div className="flex gap-3">
            <button type="button" className="min-h-11 rounded-xl px-4 bg-white/10 hover:bg-white/15" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="min-h-11 rounded-xl px-4 bg-[#8b7ae0] font-semibold text-[#0b0b10] hover:bg-[#9d8ee6]">
              Save
            </button>
          </div>
        </div>
      </form>
    </dialog>
  );
}
