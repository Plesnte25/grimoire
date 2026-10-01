import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchItem, updateItem, fetchLists, addItemToList } from "../app/api";
import { RatingInput } from "../components/RatingInput";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { formatScore, onlineRating, onlineRatingText, personalRating } from "../lib/ratings";
import { STATUSES, statusLabel } from "../lib/status";
import { deleteWithUndo } from "../lib/deleteWithUndo";

export function MediaDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();

  const { data: item } = useQuery({
    queryKey: ["item", id],
    queryFn: () => fetchItem(id!),
  });
  const { data: lists = [] } = useQuery({
    queryKey: ["lists"],
    queryFn: fetchLists,
  });

  const [progressText, setProgressText] = useState("");
  const [notes, setNotes] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Sync local editable state from the loaded item so "Save" without editing
  // reflects the real current value instead of overwriting it with "".
  useEffect(() => {
    if (item) {
      setProgressText(item.progressText ?? "");
      setNotes(item.yourNotes ?? "");
    }
  }, [item?.id, item?.progressText, item?.yourNotes]);

  const genres = useMemo(() => {
    if (!item?.genres) return [];
    try {
      return JSON.parse(item.genres) as string[];
    } catch {
      return [];
    }
  }, [item?.genres]);

  const mut = useMutation({
    mutationFn: (patch: any) => updateItem(id!, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["item", id] });
      qc.invalidateQueries({ queryKey: ["library"] });
      qc.invalidateQueries({ queryKey: ["suggestions"] });
    },
  });

  if (!item) return <div className="min-h-screen p-6">Loading…</div>;

  const mine = personalRating(item);
  const online = onlineRating(item);

  return (
    <div className="min-h-screen px-4 md:px-8 py-6 max-w-4xl mx-auto">
      <button
        className="text-sm opacity-70 hover:opacity-100"
        onClick={() => nav(-1)}
      >
        ← Back
      </button>

      <div className="mt-4 glass rounded-2xl overflow-hidden">
        <div className="relative">
          {item.backdropUrl ? (
            <img
              src={item.backdropUrl}
              alt=""
              className="w-full h-52 object-cover opacity-80"
            />
          ) : (
            <div className="w-full h-52 bg-white/5" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b10] via-black/30 to-transparent" />
          <div className="absolute bottom-0 left-0 p-4 flex gap-4">
            <div className="w-20 h-28 rounded-xl overflow-hidden bg-white/5">
              {item.posterUrl ? (
                <img
                  src={item.posterUrl}
                  alt={item.title}
                  className="w-full h-full object-cover"
                />
              ) : null}
            </div>
            <div>
              <div className="text-xl md:text-2xl font-semibold">
                {item.title}
              </div>
              <div className="text-sm opacity-70 mt-1">
                {item.mediaType}
                {item.year ? ` · ${item.year}` : ""}
              </div>
              <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                <div className="flex gap-1.5">
                  <dt className="text-white/70">You</dt>
                  <dd className="font-semibold">{mine != null ? formatScore(mine) : "Not rated"}</dd>
                </div>
                <div className="flex gap-1.5">
                  <dt className="text-white/70">Online</dt>
                  <dd className="font-semibold">{online ? onlineRatingText(online) : "No rating"}</dd>
                </div>
              </dl>
              <div className="mt-2 flex flex-wrap gap-2">
                {genres.slice(0, 6).map((g) => (
                  <span
                    key={g}
                    className="text-xs px-2 py-1 rounded-full bg-white/10"
                  >
                    {g}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 md:p-6 space-y-6">
          {item.description && (
            <div>
              <div className="text-sm font-semibold opacity-90">
                Description
              </div>
              <div className="text-sm opacity-75 mt-2 leading-relaxed">
                {item.description}
              </div>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            <div className="glass rounded-2xl p-4">
              <div className="text-sm font-semibold opacity-90">Track</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    className={`text-xs px-3 py-2 rounded-full transition ${
                      item.status === s
                        ? "bg-white/20"
                        : "bg-white/10 hover:bg-white/15"
                    }`}
                    aria-pressed={item.status === s}
                    onClick={() => mut.mutate({ status: s })}
                  >
                    {statusLabel(s, item.mediaType)}
                  </button>
                ))}
              </div>

              <div className="mt-4">
                <div className="text-xs text-white/70">Your rating</div>
                <div className="mt-1">
                  <RatingInput
                    value={mine}
                    onChange={(v) => mut.mutate({ yourRating: v })}
                  />
                </div>
              </div>

              <div className="mt-4">
                <div className="text-xs opacity-70">Progress</div>
                <div className="flex gap-2 mt-2">
                  <input
                    className="flex-1 rounded-xl bg-black/30 border border-white/10 px-3 py-2 outline-none text-sm"
                    placeholder="e.g. S2E5 / Page 123 / Listened 12x"
                    value={progressText}
                    onChange={(e) => setProgressText(e.target.value)}
                  />
                  <button
                    className="rounded-xl px-3 py-2 bg-white/10 hover:bg-white/15 transition text-sm"
                    onClick={() => mut.mutate({ progressText })}
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>

            <div className="glass rounded-2xl p-4">
              <div className="text-sm font-semibold opacity-90">Lists</div>
              <div className="mt-3 space-y-2">
                {lists.map((l) => (
                  <button
                    key={l.id}
                    className="w-full text-left rounded-xl px-3 py-2 bg-white/10 hover:bg-white/15 transition text-sm"
                    onClick={async () => {
                      await addItemToList(l.id, item.id);
                      // no need to refetch for MVP
                    }}
                  >
                    + Add to {l.name}
                  </button>
                ))}
                <button
                  className="w-full text-left rounded-xl px-3 py-2 bg-white/10 hover:bg-white/15 transition text-sm"
                  onClick={() => nav("/lists")}
                >
                  Manage lists →
                </button>
              </div>

              <div className="mt-5">
                <div className="text-xs opacity-70">Notes</div>
                <textarea
                  className="mt-2 w-full min-h-[90px] rounded-xl bg-black/30 border border-white/10 px-3 py-2 outline-none text-sm"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
                <button
                  className="mt-2 rounded-xl px-3 py-2 bg-white/10 hover:bg-white/15 transition text-sm"
                  onClick={() => mut.mutate({ yourNotes: notes })}
                >
                  Save notes
                </button>
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 pt-4">
            <button
              type="button"
              className="min-h-11 rounded-xl px-4 text-sm text-rose-300 hover:bg-rose-500/10"
              onClick={() => setConfirmDelete(true)}
            >
              Remove from library
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title={`Remove "${item.title}"?`}
        body="Its status, rating, progress and notes are removed too. You can undo for 10 seconds."
        confirmLabel="Remove"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          deleteWithUndo(qc, item);
          // Opened from a direct link there's no in-app history to go back to.
          if ((window.history.state?.idx ?? 0) > 0) nav(-1);
          else nav(`/category/${item.mediaType}`);
        }}
      />
    </div>
  );
}
