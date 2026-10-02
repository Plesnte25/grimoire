import { useEffect, useRef, useState } from "react";
import { formatScore } from "../lib/ratings";

const STEP = 0.5;
const MAX = 10;
// Keyboard changes are saved once the user pauses, not on every key press.
const KEY_COMMIT_MS = 600;

function clampRating(v: number): number | null {
  if (v < STEP) return null;
  return Math.min(MAX, Math.round(v / STEP) * STEP);
}

/**
 * Ten stars with half steps. Click/tap sets the rating, arrow keys adjust it
 * by half a star, Delete/Backspace or "Clear" removes it. null = not rated.
 */
export function RatingInput({
  value,
  onChange,
  label = "Your rating",
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  label?: string;
}) {
  const [draft, setDraft] = useState<number | null>(value);
  const [hover, setHover] = useState<number | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => setDraft(value), [value]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  function commit(v: number | null, delayMs = 0) {
    setDraft(v);
    window.clearTimeout(timer.current);
    const save = () => {
      if (v !== value) onChange(v);
    };
    if (delayMs) timer.current = window.setTimeout(save, delayMs);
    else save();
  }

  function fromPointer(e: React.PointerEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    return Math.max(STEP, Math.ceil(x * (MAX / STEP)) * STEP);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const cur = draft ?? 0;
    let next: number | null | undefined;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") next = clampRating(cur + STEP);
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = clampRating(cur - STEP);
    else if (e.key === "Home") next = STEP;
    else if (e.key === "End") next = MAX;
    else if (e.key === "Delete" || e.key === "Backspace") next = null;
    if (next === undefined) return;
    e.preventDefault();
    commit(next, KEY_COMMIT_MS);
  }

  const shown = hover ?? draft ?? 0;
  const text = draft == null ? "Not rated" : `${formatScore(draft)} / 10`;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <div
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={MAX}
        aria-valuenow={draft ?? 0}
        aria-valuetext={draft == null ? "Not rated" : `${formatScore(draft)} out of 10`}
        className="flex min-h-11 cursor-pointer select-none items-center gap-1 rounded-lg py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        onKeyDown={onKeyDown}
        onPointerMove={(e) => e.pointerType === "mouse" && setHover(fromPointer(e))}
        onPointerLeave={() => setHover(null)}
        onClick={(e) => commit(fromPointer(e))}
      >
        {Array.from({ length: MAX }, (_, i) => {
          const fill = Math.min(Math.max(shown - i, 0), 1);
          const state = fill >= 1 ? "full" : fill > 0 ? "half" : "empty";
          return <span key={i} aria-hidden="true" className="rating-cell flex-1" data-fill={state} />;
        })}
      </div>
      <span className="text-sm tabular-nums" aria-hidden="true">
        {hover != null ? `${formatScore(hover)} / 10` : text}
      </span>
      {draft != null ? (
        <button
          type="button"
          className="min-h-11 px-2 text-sm text-[var(--acc)] underline underline-offset-2"
          onClick={() => commit(null)}
        >
          Clear
        </button>
      ) : null}
    </div>
  );
}
