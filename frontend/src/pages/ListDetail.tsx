import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteList, fetchList, removeListItem, reorderList, setListItemNote, updateList } from "../app/api";
import type { CustomList } from "../types";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { showToast } from "../lib/toast";

const TYPE_LABEL = { MOVIE: "Movies", TV: "TV", ANIME: "Anime", BOOK: "Books" } as const;
const iconButton =
  "min-h-11 min-w-11 rounded-xl bg-white/10 hover:bg-white/15 disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white";

type Entry = CustomList["items"][number];

function NoteEditor({ entry, onSave }: { entry: Entry; onSave: (note: string | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry.note ?? "");
  if (!editing) {
    return (
      <div className="text-sm">
        {entry.note ? <p className="text-white/85 whitespace-pre-wrap">{entry.note}</p> : null}
        <button type="button" className="min-h-11 text-xs underline underline-offset-2 text-white/75" onClick={() => setEditing(true)}>
          {entry.note ? "Edit note" : "Add a note"}
        </button>
      </div>
    );
  }
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(draft.trim() || null);
        setEditing(false);
      }}
    >
      <textarea
        aria-label={`Note for ${entry.media.title}`}
        className="w-full min-h-20 rounded-xl bg-black/30 border border-white/15 px-3 py-2 text-sm"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />
      <div className="flex gap-2">
        <button type="submit" className="min-h-11 rounded-xl px-4 bg-white/10 hover:bg-white/15 text-sm">Save</button>
        <button type="button" className="min-h-11 px-3 text-sm underline" onClick={() => setEditing(false)}>Cancel</button>
      </div>
    </form>
  );
}

export function ListDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data: list } = useQuery({ queryKey: ["list", id], queryFn: () => fetchList(id!) });

  const [items, setItems] = useState<Entry[]>([]);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  useEffect(() => {
    if (list) {
      setItems(list.items);
      setName(list.name);
    }
  }, [list]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["list", id] });
    qc.invalidateQueries({ queryKey: ["lists"] });
    qc.invalidateQueries({ queryKey: ["top10"] });
  };

  if (!list) return <div className="min-h-screen p-6">Loading…</div>;

  const isTop10 = list.kind === "TOP10";
  const ranked = isTop10 || list.isRanked;
  const title = isTop10 ? `Top 10 ${list.mediaType ? TYPE_LABEL[list.mediaType] : ""}` : list.name;

  const move = async (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setItems(next);
    try {
      await reorderList(list.id, next.map((i) => i.id));
    } catch {
      showToast({ message: "Couldn't save the new order", timeoutMs: 6000 });
    }
    refresh();
  };

  return (
    <div className="min-h-screen px-4 md:px-8 py-6 max-w-4xl mx-auto">
      <button className="min-h-11 text-sm text-white/80 hover:text-white" onClick={() => nav(-1)}>
        ← Back
      </button>

      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        {renaming && !isTop10 ? (
          <form
            className="flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!name.trim()) return;
              await updateList(list.id, { name: name.trim() });
              setRenaming(false);
              refresh();
            }}
          >
            <input aria-label="List name" className="min-h-11 rounded-xl bg-black/30 border border-white/15 px-3" value={name} onChange={(e) => setName(e.target.value)} />
            <button type="submit" className="min-h-11 rounded-xl px-4 bg-white/10">Save</button>
          </form>
        ) : (
          <div>
            <h1 className="text-2xl font-semibold">{title}</h1>
            <p className="text-sm text-white/75 mt-1">
              {items.length} item{items.length === 1 ? "" : "s"}
              {isTop10 ? " of 10" : ""}
            </p>
          </div>
        )}
        {!isTop10 ? (
          <div className="flex flex-wrap gap-2">
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-5 w-5"
                checked={list.isRanked}
                onChange={async (e) => {
                  await updateList(list.id, { isRanked: e.target.checked });
                  refresh();
                }}
              />
              Ranked
            </label>
            <button className="min-h-11 rounded-xl px-4 bg-white/10 hover:bg-white/15 text-sm" onClick={() => setRenaming(true)}>
              Rename
            </button>
            <button className="min-h-11 rounded-xl px-4 text-sm text-rose-300 hover:bg-rose-500/10" onClick={() => setConfirmDelete(true)}>
              Delete list
            </button>
          </div>
        ) : null}
      </div>

      {items.length === 0 ? (
        <p className="mt-6 text-sm text-white/75">
          Empty. Add things from their detail page ({isTop10 ? "“Add to your Top 10”" : "the Lists panel"}).
        </p>
      ) : (
        <ol className="mt-6 space-y-2">
          {items.map((entry, i) => (
            <li
              key={entry.id}
              draggable
              onDragStart={() => setDragIndex(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIndex != null) move(dragIndex, i);
                setDragIndex(null);
              }}
              className={`flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 ${dragIndex === i ? "opacity-50" : ""}`}
            >
              {ranked ? (
                <div className="w-8 shrink-0 pt-1 text-xl font-semibold tabular-nums text-white/85" aria-label={`Rank ${i + 1}`}>
                  {i + 1}
                </div>
              ) : null}
              <button className="h-24 w-16 shrink-0 overflow-hidden rounded-lg bg-white/5" onClick={() => nav(`/media/${entry.media.id}`)} aria-label={`Open ${entry.media.title}`}>
                {entry.media.posterUrl ? <img src={entry.media.posterUrl} alt="" className="h-full w-full object-cover" /> : null}
              </button>
              <div className="min-w-0 flex-1">
                <button className="text-left font-semibold hover:underline" onClick={() => nav(`/media/${entry.media.id}`)}>
                  {entry.media.title}
                </button>
                <div className="text-xs text-white/75">{entry.media.year ?? ""}</div>
                <NoteEditor
                  entry={entry}
                  onSave={async (note) => {
                    await setListItemNote(list.id, entry.id, note);
                    refresh();
                  }}
                />
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                <button className={iconButton} aria-label={`Move ${entry.media.title} up`} disabled={i === 0} onClick={() => move(i, i - 1)}>↑</button>
                <button className={iconButton} aria-label={`Move ${entry.media.title} down`} disabled={i === items.length - 1} onClick={() => move(i, i + 1)}>↓</button>
                <button
                  className={iconButton}
                  aria-label={`Remove ${entry.media.title} from this list`}
                  onClick={async () => {
                    await removeListItem(list.id, entry.id);
                    refresh();
                  }}
                >
                  ×
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete "${list.name}"?`}
        body="The list is deleted. The items stay in your library."
        confirmLabel="Delete"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          setConfirmDelete(false);
          await deleteList(list.id);
          qc.invalidateQueries({ queryKey: ["lists"] });
          nav("/lists");
        }}
      />
    </div>
  );
}
