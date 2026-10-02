import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteTierList, fetchLibrary, fetchTierList, saveTierEntries, updateTierList } from "../app/api";
import type { MediaItem, Tier } from "../types";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { showToast } from "../lib/toast";

const TIERS: Tier[] = ["S", "A", "B", "C", "D"];
const TIER_COLOR: Record<Tier, string> = {
  S: "bg-[var(--tier-s)] text-[var(--tier-ink)]",
  A: "bg-[var(--tier-a)] text-[var(--tier-ink)]",
  B: "bg-[var(--tier-b)] text-[var(--tier-ink)]",
  C: "bg-[var(--tier-c)] text-[var(--tx)]",
  D: "bg-[var(--tier-d)] text-[var(--tx)]",
};

type Placement = { media: MediaItem; tier: Tier };

export function TierListPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data: tierList } = useQuery({ queryKey: ["tier-list", id], queryFn: () => fetchTierList(id!) });
  const { data: library = [] } = useQuery({ queryKey: ["library", "all"], queryFn: () => fetchLibrary() });

  const [placements, setPlacements] = useState<Placement[]>([]);
  const [query, setQuery] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (tierList) {
      setPlacements(tierList.entries.map((e) => ({ media: e.media, tier: e.tier })));
      setName(tierList.name);
    }
  }, [tierList]);

  const placedIds = useMemo(() => new Set(placements.map((p) => p.media.id)), [placements]);
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return library
      .filter((m) => !placedIds.has(m.id))
      .filter((m) => m.title.toLowerCase().includes(q) || (m.nativeTitle ?? "").toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, library, placedIds]);

  if (!tierList) return <div className="mx-auto max-w-5xl px-5 py-12 text-sm text-[var(--tx3)]">Loading tier list…</div>;

  const save = async (next: Placement[]) => {
    setPlacements(next);
    try {
      await saveTierEntries(tierList.id, next.map((p) => ({ mediaId: p.media.id, tier: p.tier })));
      qc.invalidateQueries({ queryKey: ["tier-lists"] });
    } catch {
      showToast({ message: "Couldn't save the tier list", timeoutMs: 6000 });
    }
  };

  const place = (media: MediaItem, tier: Tier) =>
    save([...placements.filter((p) => p.media.id !== media.id), { media, tier }]);
  const unplace = (mediaId: string) => save(placements.filter((p) => p.media.id !== mediaId));

  return (
    <div className="min-h-screen px-4 md:px-8 py-6 max-w-5xl mx-auto space-y-6">
      <button className="min-h-11 text-sm text-[var(--tx2)] hover:text-[var(--tx)]" onClick={() => nav(-1)}>
        ← Back
      </button>

      <div className="flex flex-wrap items-end justify-between gap-3">
        {renaming ? (
          <form
            className="flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!name.trim()) return;
              await updateTierList(tierList.id, { name: name.trim() });
              setRenaming(false);
              qc.invalidateQueries({ queryKey: ["tier-list", id] });
            }}
          >
            <input aria-label="Tier list name" className="min-h-11 rounded-xl bg-black/30 border border-white/15 px-3" value={name} onChange={(e) => setName(e.target.value)} />
            <button type="submit" className="min-h-11 rounded-xl px-4 bg-white/10">Save</button>
          </form>
        ) : (
          <h1 className="font-display text-3xl font-medium">{tierList.name}</h1>
        )}
        <div className="flex gap-2">
          <button className="min-h-11 rounded-xl px-4 bg-white/10 hover:bg-white/15 text-sm" onClick={() => setRenaming(true)}>Rename</button>
          <button className="min-h-11 rounded-xl px-4 text-sm text-rose-300 hover:bg-rose-500/10" onClick={() => setConfirmDelete(true)}>Delete</button>
        </div>
      </div>

      <div className="space-y-2">
        {TIERS.map((tier) => {
          const row = placements.filter((p) => p.tier === tier);
          return (
            <section
              key={tier}
              aria-label={`Tier ${tier}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                const p = placements.find((x) => x.media.id === dragId);
                if (p) place(p.media, tier);
                setDragId(null);
              }}
              className="surface-card flex min-h-28 rounded-[var(--radius-card)]"
            >
              <div className={`flex w-14 shrink-0 items-center justify-center rounded-l-2xl text-2xl font-bold ${TIER_COLOR[tier]}`}>{tier}</div>
              <ul className="flex flex-1 flex-wrap gap-2 p-2">
                {row.map((p) => (
                  <li
                    key={p.media.id}
                    draggable
                    onDragStart={() => setDragId(p.media.id)}
                    className="surface-raised w-24 rounded-xl p-1"
                  >
                    <div className="h-28 overflow-hidden rounded-lg bg-white/5">
                      {p.media.posterUrl ? <img src={p.media.posterUrl} alt="" className="h-full w-full object-cover" /> : null}
                    </div>
                    <div className="mt-1 line-clamp-2 text-xs">{p.media.title}</div>
                    <div className="mt-1 flex gap-1">
                      <select
                        aria-label={`Tier for ${p.media.title}`}
                        className="min-h-9 flex-1 rounded-lg border border-[var(--line2)] bg-[var(--s1)] text-xs text-[var(--tx)]"
                        value={p.tier}
                        onChange={(e) => place(p.media, e.target.value as Tier)}
                      >
                        {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <button className="min-h-9 w-8 rounded-lg hover:bg-white/10" aria-label={`Remove ${p.media.title}`} onClick={() => unplace(p.media.id)}>×</button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <section aria-labelledby="add-heading" className="surface-card space-y-3 rounded-[var(--radius-panel)] p-4">
        <h2 id="add-heading" className="text-sm font-semibold">Add from your library</h2>
        <input
          className="min-h-11 w-full rounded-xl border border-[var(--line2)] bg-[var(--s1)] px-3 text-sm text-[var(--tx)]"
          placeholder="Search your library…"
          aria-label="Search your library"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <ul className="space-y-2">
          {results.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/5 p-2">
              <span className="text-sm">
                {m.title} <span className="text-white/70">{m.year ?? ""}</span>
              </span>
              <span className="flex gap-1" role="group" aria-label={`Place ${m.title} in tier`}>
                {TIERS.map((t) => (
                  <button key={t} className={`min-h-11 min-w-11 rounded-lg font-bold ${TIER_COLOR[t]}`} onClick={() => place(m, t)} aria-label={`Put ${m.title} in tier ${t}`}>
                    {t}
                  </button>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete "${tierList.name}"?`}
        body="The tier list is deleted. The items stay in your library."
        confirmLabel="Delete"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          setConfirmDelete(false);
          await deleteTierList(tierList.id);
          qc.invalidateQueries({ queryKey: ["tier-lists"] });
          nav("/lists");
        }}
      />
    </div>
  );
}
