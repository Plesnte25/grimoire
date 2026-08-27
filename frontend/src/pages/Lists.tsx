import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchLists, createList } from "../app/api";
import { useNavigate } from "react-router-dom";

export function Lists() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data: lists = [] } = useQuery({
    queryKey: ["lists"],
    queryFn: fetchLists,
  });

  const [name, setName] = useState("");

  const mut = useMutation({
    mutationFn: () => createList({ name }),
    onSuccess: () => {
      setName("");
      qc.invalidateQueries({ queryKey: ["lists"] });
    },
  });

  return (
    <div className="min-h-screen px-4 md:px-8 py-6 max-w-4xl mx-auto">
      <button
        className="text-sm opacity-70 hover:opacity-100"
        onClick={() => nav(-1)}
      >
        ← Back
      </button>
      <div className="mt-4 text-2xl font-semibold">Lists</div>

      <div className="mt-4 glass rounded-2xl p-4 flex gap-2">
        <input
          className="flex-1 rounded-xl bg-black/30 border border-white/10 px-3 py-2 outline-none text-sm"
          placeholder="New list name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          className="rounded-xl px-4 py-2 bg-white/10 hover:bg-white/15 transition"
          onClick={() => mut.mutate()}
          disabled={!name.trim()}
        >
          Create
        </button>
      </div>

      <div className="mt-6 space-y-3">
        {lists.map((l) => (
          <button
            key={l.id}
            className="w-full text-left glass rounded-2xl p-4 hover:bg-white/10 transition"
            onClick={() => nav(`/lists/${l.id}`)}
          >
            <div className="font-semibold">{l.name}</div>
            <div className="text-sm opacity-70 mt-1">
              {l.items?.length ?? 0} items
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
