import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchItem, updateItem, fetchLists, addItemToList } from "../app/api";

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
              <div className="text-sm opacity-80 mt-2">
                ⭐ {item.yourRating ?? item.globalRating} &nbsp;&nbsp; 🌍{" "}
                {item.globalRating ?? "—"}{" "}
                <span className="opacity-60">
                  {item.globalRatingText ?? ""}
                </span>
              </div>
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
                {(
                  [
                    "PLANNED",
                    "IN_PROGRESS",
                    "COMPLETED",
                    "ON_HOLD",
                    "DROPPED",
                  ] as const
                ).map((s) => (
                  <button
                    key={s}
                    className={`text-xs px-3 py-2 rounded-full transition ${
                      item.status === s
                        ? "bg-white/20"
                        : "bg-white/10 hover:bg-white/15"
                    }`}
                    onClick={() => mut.mutate({ status: s })}
                  >
                    {s}
                  </button>
                ))}
              </div>

              <div className="mt-4">
                <div className="text-xs opacity-70">Your rating (0–10)</div>
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={0.5}
                  value={item.yourRating ?? 0}
                  onChange={(e) =>
                    mut.mutate({ yourRating: Number(e.target.value) })
                  }
                  className="w-full mt-2"
                />
              </div>

              <div className="mt-4">
                <div className="text-xs opacity-70">Progress</div>
                <div className="flex gap-2 mt-2">
                  <input
                    className="flex-1 rounded-xl bg-black/30 border border-white/10 px-3 py-2 outline-none text-sm"
                    placeholder="e.g. S2E5 / Page 123 / Listened 12x"
                    defaultValue={item.progressText ?? ""}
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
                  defaultValue={item.yourNotes ?? ""}
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
        </div>
      </div>
    </div>
  );
}
