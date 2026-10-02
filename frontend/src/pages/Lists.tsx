import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createList, createTierList, fetchLists, fetchTierLists, fetchTop10 } from "../app/api";
import type { MediaType } from "../types";

const TOP10_TYPES: { type: MediaType; label: string }[] = [
  { type: "MOVIE", label: "Movies" },
  { type: "TV", label: "TV" },
  { type: "ANIME", label: "Anime" },
  { type: "BOOK", label: "Books" },
];

const card = "surface-card w-full min-h-11 text-left rounded-[var(--radius-card)] p-4 transition-colors hover:bg-[var(--s2)]";

function Top10Card({ type, label }: { type: MediaType; label: string }) {
  const nav = useNavigate();
  const { data } = useQuery({ queryKey: ["top10", type], queryFn: () => fetchTop10(type) });
  return (
    <button className={card} onClick={() => data && nav(`/lists/${data.id}`)} disabled={!data}>
      <div className="font-display text-lg font-medium">Top 10 {label}</div>
      <div className="mt-1 text-sm text-[var(--tx3)]">{data ? `${data.items.length}/10` : "Loading…"}</div>
    </button>
  );
}

export function Lists() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data: lists = [] } = useQuery({ queryKey: ["lists"], queryFn: fetchLists });
  const { data: tierLists = [] } = useQuery({ queryKey: ["tier-lists"], queryFn: fetchTierLists });
  const [name, setName] = useState("");
  const [tierName, setTierName] = useState("");

  const mut = useMutation({
    mutationFn: () => createList({ name: name.trim() }),
    onSuccess: (list) => {
      setName("");
      qc.invalidateQueries({ queryKey: ["lists"] });
      nav(`/lists/${list.id}`);
    },
  });
  const tierMut = useMutation({
    mutationFn: () => createTierList(tierName.trim()),
    onSuccess: (t) => {
      setTierName("");
      qc.invalidateQueries({ queryKey: ["tier-lists"] });
      nav(`/tier-lists/${t.id}`);
    },
  });

  const userLists = lists.filter((l) => l.kind !== "TOP10");

  return (
    <div className="mx-auto max-w-4xl space-y-9 px-5 py-7 md:px-10 md:py-10">
      <button className="min-h-11 text-sm text-[var(--tx2)] hover:text-[var(--tx)]" onClick={() => nav(-1)}>
        ← Back
      </button>

      <section aria-labelledby="top10-heading">
        <h1 id="top10-heading" className="font-display text-3xl font-medium">Favourites</h1>
        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
          {TOP10_TYPES.map((t) => <Top10Card key={t.type} {...t} />)}
        </div>
      </section>

      <section aria-labelledby="lists-heading">
        <h2 id="lists-heading" className="font-display text-xl font-medium">Lists</h2>
        <form
          className="surface-card mt-3 flex gap-2 rounded-[var(--radius-panel)] p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) mut.mutate();
          }}
        >
          <input
            className="min-h-11 flex-1 rounded-xl border border-[var(--line2)] bg-[var(--s1)] px-3 text-sm text-[var(--tx)]"
            placeholder="New list name"
            aria-label="New list name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button type="submit" className="min-h-11 rounded-xl bg-[var(--accbg)] px-4 text-sm font-semibold text-[var(--acc-ink)] disabled:opacity-50" disabled={!name.trim()}>
            Create
          </button>
        </form>
        <div className="mt-3 space-y-3">
          {userLists.map((l) => (
            <button key={l.id} className={card} onClick={() => nav(`/lists/${l.id}`)}>
              <div className="font-semibold">{l.name}</div>
              <div className="mt-1 text-sm text-[var(--tx3)]">
                {l.items.length} item{l.items.length === 1 ? "" : "s"}
                {l.isRanked ? " · ranked" : ""}
              </div>
            </button>
          ))}
          {userLists.length === 0 ? <p className="text-sm text-[var(--tx3)]">No lists yet.</p> : null}
        </div>
      </section>

      <section aria-labelledby="tiers-heading">
        <h2 id="tiers-heading" className="font-display text-xl font-medium">Tier lists</h2>
        <form
          className="surface-card mt-3 flex gap-2 rounded-[var(--radius-panel)] p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (tierName.trim()) tierMut.mutate();
          }}
        >
          <input
            className="min-h-11 flex-1 rounded-xl border border-[var(--line2)] bg-[var(--s1)] px-3 text-sm text-[var(--tx)]"
            placeholder="New tier list (e.g. Shounen anime)"
            aria-label="New tier list name"
            value={tierName}
            onChange={(e) => setTierName(e.target.value)}
          />
          <button type="submit" className="min-h-11 rounded-xl bg-[var(--accbg)] px-4 text-sm font-semibold text-[var(--acc-ink)] disabled:opacity-50" disabled={!tierName.trim()}>
            Create
          </button>
        </form>
        <div className="mt-3 space-y-3">
          {tierLists.map((t) => (
            <button key={t.id} className={card} onClick={() => nav(`/tier-lists/${t.id}`)}>
              <div className="font-semibold">{t.name}</div>
              <div className="mt-1 text-sm text-[var(--tx3)]">{t.entries.length} placed</div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
