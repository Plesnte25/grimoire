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

const card = "w-full min-h-11 text-left glass rounded-2xl p-4 hover:bg-white/10 transition";

function Top10Card({ type, label }: { type: MediaType; label: string }) {
  const nav = useNavigate();
  const { data } = useQuery({ queryKey: ["top10", type], queryFn: () => fetchTop10(type) });
  return (
    <button className={card} onClick={() => data && nav(`/lists/${data.id}`)} disabled={!data}>
      <div className="font-semibold">Top 10 {label}</div>
      <div className="text-sm text-white/75 mt-1">{data ? `${data.items.length}/10` : "…"}</div>
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
    <div className="min-h-screen px-4 md:px-8 py-6 max-w-4xl mx-auto space-y-8">
      <button className="min-h-11 text-sm text-white/80 hover:text-white" onClick={() => nav(-1)}>
        ← Back
      </button>

      <section aria-labelledby="top10-heading">
        <h1 id="top10-heading" className="text-2xl font-semibold">Favourites</h1>
        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
          {TOP10_TYPES.map((t) => <Top10Card key={t.type} {...t} />)}
        </div>
      </section>

      <section aria-labelledby="lists-heading">
        <h2 id="lists-heading" className="text-xl font-semibold">Lists</h2>
        <form
          className="mt-3 glass rounded-2xl p-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) mut.mutate();
          }}
        >
          <input
            className="flex-1 min-h-11 rounded-xl bg-black/30 border border-white/15 px-3 text-sm"
            placeholder="New list name"
            aria-label="New list name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button type="submit" className="min-h-11 rounded-xl px-4 bg-white/10 hover:bg-white/15" disabled={!name.trim()}>
            Create
          </button>
        </form>
        <div className="mt-3 space-y-3">
          {userLists.map((l) => (
            <button key={l.id} className={card} onClick={() => nav(`/lists/${l.id}`)}>
              <div className="font-semibold">{l.name}</div>
              <div className="text-sm text-white/75 mt-1">
                {l.items.length} item{l.items.length === 1 ? "" : "s"}
                {l.isRanked ? " · ranked" : ""}
              </div>
            </button>
          ))}
          {userLists.length === 0 ? <p className="text-sm text-white/75">No lists yet.</p> : null}
        </div>
      </section>

      <section aria-labelledby="tiers-heading">
        <h2 id="tiers-heading" className="text-xl font-semibold">Tier lists</h2>
        <form
          className="mt-3 glass rounded-2xl p-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (tierName.trim()) tierMut.mutate();
          }}
        >
          <input
            className="flex-1 min-h-11 rounded-xl bg-black/30 border border-white/15 px-3 text-sm"
            placeholder="New tier list (e.g. Shounen anime)"
            aria-label="New tier list name"
            value={tierName}
            onChange={(e) => setTierName(e.target.value)}
          />
          <button type="submit" className="min-h-11 rounded-xl px-4 bg-white/10 hover:bg-white/15" disabled={!tierName.trim()}>
            Create
          </button>
        </form>
        <div className="mt-3 space-y-3">
          {tierLists.map((t) => (
            <button key={t.id} className={card} onClick={() => nav(`/tier-lists/${t.id}`)}>
              <div className="font-semibold">{t.name}</div>
              <div className="text-sm text-white/75 mt-1">{t.entries.length} placed</div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
