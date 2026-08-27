import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchList } from "../app/api";
import { MediaCard } from "../components/MediaCard";

export function ListDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { data: list } = useQuery({
    queryKey: ["list", id],
    queryFn: () => fetchList(id!),
  });

  if (!list) return <div className="min-h-screen p-6">Loading…</div>;

  return (
    <div className="min-h-screen px-4 md:px-8 py-6 max-w-4xl mx-auto">
      <button
        className="text-sm opacity-70 hover:opacity-100"
        onClick={() => nav(-1)}
      >
        ← Back
      </button>
      <div className="mt-4 text-2xl font-semibold">{list.name}</div>
      <div className="text-sm opacity-70 mt-1">{list.items.length} items</div>

      <div className="mt-6 space-y-2">
        {list.items.map((li) => (
          <MediaCard
            key={li.id}
            item={li.media}
            onOpen={() => nav(`/media/${li.media.id}`)}
          />
        ))}
      </div>
    </div>
  );
}
