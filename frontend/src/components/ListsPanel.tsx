import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import type { MediaItem } from "../types";
import { addItemToList, fetchListsContaining, fetchTop10, removeListItem } from "../app/api";
import { showToast } from "../lib/toast";

const TYPE_LABEL = { MOVIE: "Movies", TV: "TV", ANIME: "Anime", BOOK: "Books" } as const;

export function ListsPanel({ item }: { item: MediaItem }) {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data: lists = [] } = useQuery({
    queryKey: ["lists", "containing", item.id],
    queryFn: () => fetchListsContaining(item.id),
  });
  const { data: top10 } = useQuery({
    queryKey: ["top10", item.mediaType],
    queryFn: () => fetchTop10(item.mediaType),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["lists"] });
    qc.invalidateQueries({ queryKey: ["top10"] });
  };

  const toggle = async (listId: string, name: string, entryId?: string) => {
    try {
      if (entryId) {
        await removeListItem(listId, entryId);
        showToast({ message: `Removed from ${name}`, timeoutMs: 4000 });
      } else {
        await addItemToList(listId, item.id);
        showToast({ message: `Added to ${name}`, timeoutMs: 4000 });
      }
    } catch (err: any) {
      showToast({ message: err?.response?.data?.error ?? "Couldn't update the list", timeoutMs: 6000 });
    }
    refresh();
  };

  const userLists = lists.filter((l) => l.kind !== "TOP10");
  const topEntry = top10?.items.find((it) => it.mediaId === item.id);
  const topName = `Top 10 ${TYPE_LABEL[item.mediaType]}`;

  return (
    <div className="space-y-2">
      {top10 ? (
        <button
          type="button"
          aria-pressed={!!topEntry}
          className="flex min-h-11 w-full items-center justify-between rounded-xl bg-white/10 px-3 text-left text-sm hover:bg-white/15"
          onClick={() => toggle(top10.id, topName, topEntry?.id)}
        >
          <span>{topEntry ? `#${topEntry.order + 1} in your ${topName}` : `Add to your ${topName}`}</span>
          <span className="text-white/70">{top10.items.length}/10</span>
        </button>
      ) : null}
      {userLists.map((l) => {
        const entry = l.items.find((it) => it.mediaId === item.id);
        return (
          <button
            key={l.id}
            type="button"
            aria-pressed={!!entry}
            className="flex min-h-11 w-full items-center justify-between rounded-xl bg-white/10 px-3 text-left text-sm hover:bg-white/15"
            onClick={() => toggle(l.id, l.name, entry?.id)}
          >
            <span>{l.name}</span>
            <span className="text-white/80">{entry ? "✓ In list" : "+ Add"}</span>
          </button>
        );
      })}
      <button
        type="button"
        className="min-h-11 w-full rounded-xl px-3 text-left text-sm underline underline-offset-2 hover:bg-white/10"
        onClick={() => nav("/lists")}
      >
        Manage lists →
      </button>
    </div>
  );
}
