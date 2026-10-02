import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createListShare, deleteList, fetchList, removeListItem, reorderList, revokeListShare, setListItemNote, updateList } from "../app/api";
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
        className="min-h-20 w-full rounded-xl border border-[var(--line2)] bg-[var(--s1)] px-3 py-2 text-sm text-[var(--tx)]"
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
  const [shareUrl, setShareUrl] = useState("");
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [confirmRevokeShare, setConfirmRevokeShare] = useState(false);

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

  if (!list) return <div className="mx-auto max-w-4xl px-5 py-12 text-sm text-[var(--tx3)]">Loading list…</div>;

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
    <div className="mx-auto max-w-4xl px-5 py-7 md:px-10 md:py-10">
      <button className="min-h-11 text-sm text-[var(--tx2)] hover:text-[var(--tx)]" onClick={() => nav(-1)}>
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
            <input aria-label="List name" className="min-h-11 rounded-xl border border-[var(--line2)] bg-[var(--s1)] px-3 text-[var(--tx)]" value={name} onChange={(e) => setName(e.target.value)} />
            <button type="submit" className="min-h-11 rounded-xl bg-[var(--accbg)] px-4 text-sm font-semibold text-[var(--acc-ink)]">Save</button>
          </form>
        ) : (
          <div>
            <h1 className="font-display text-3xl font-medium">{title}</h1>
            <p className="mt-1 text-sm text-[var(--tx3)]">
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
            <button
              type="button"
              disabled={shareBusy}
              className="min-h-11 rounded-xl border border-[var(--line2)] px-4 text-sm text-[var(--tx)] hover:bg-[var(--s2)] disabled:opacity-50"
              onClick={async () => {
                setShareError(null);
                setShareBusy(true);
                try {
                  const token = await createListShare(list.id);
                  setShareUrl(new URL(`/shared/${token}`, window.location.origin).toString());
                } catch (error: any) {
                  setShareError(error?.response?.data?.error ?? "Could not create a share link");
                } finally {
                  setShareBusy(false);
                }
              }}
            >
              {shareBusy ? "Creating…" : shareUrl ? "Create replacement link" : "Create share link"}
            </button>
          </div>
        ) : null}
      </div>

      {!isTop10 ? (
        <section className="surface-raised mt-5 rounded-[var(--radius-card)] p-4" aria-label="Share this list">
          <p className="text-sm font-medium">Public link</p>
          <p className="mt-1 text-xs text-[var(--tx3)]">Anyone with the link can view titles and order. Creating a replacement invalidates the previous link.</p>
          {shareUrl ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <input readOnly aria-label="Public list link" className="min-h-11 min-w-0 flex-1 rounded-xl border border-[var(--line2)] bg-[var(--s1)] px-3 text-sm text-[var(--tx)]" value={shareUrl} />
              <button type="button" className="min-h-11 rounded-xl bg-[var(--accbg)] px-4 text-sm font-semibold text-[var(--acc-ink)]" onClick={async () => {
                try {
                  await navigator.clipboard.writeText(shareUrl);
                  showToast({ message: "Link copied", timeoutMs: 3000 });
                } catch {
                  setShareError("Clipboard access is unavailable. Select and copy the link instead.");
                }
              }}>Copy</button>
            </div>
          ) : null}
          <button type="button" className="mt-2 min-h-11 text-xs text-[var(--err)] underline underline-offset-2" onClick={() => setConfirmRevokeShare(true)}>Revoke any active link</button>
          {shareError ? <p role="alert" className="mt-2 text-xs text-[var(--err)]">{shareError}</p> : null}
        </section>
      ) : null}

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
              className={`surface-card flex gap-3 rounded-[var(--radius-card)] p-3 ${dragIndex === i ? "opacity-50" : ""}`}
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
      <ConfirmDialog
        open={confirmRevokeShare}
        title="Revoke this share link?"
        body="Anyone using the public link will no longer be able to open this list."
        confirmLabel="Revoke link"
        onCancel={() => setConfirmRevokeShare(false)}
        onConfirm={async () => {
          setConfirmRevokeShare(false);
          try {
            await revokeListShare(list.id);
            setShareUrl("");
            setShareError(null);
            showToast({ message: "Share link revoked", timeoutMs: 3000 });
          } catch (error: any) {
            setShareError(error?.response?.data?.error ?? "Could not revoke this link");
          }
        }}
      />
    </div>
  );
}
