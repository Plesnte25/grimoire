import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { MediaItem } from "../../types";
import { MediaCard } from "../MediaCard";

const EASE = [0.22, 1, 0.36, 1] as const;

export function CardStack({
  items,
  collectionName,
  onOpenItem,
  onDeleteItem,
}: {
  items: MediaItem[];
  collectionName?: string | null;
  onOpenItem: (item: MediaItem) => void;
  onDeleteItem?: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const top3 = items.slice(0, 3);
  const label = collectionName ?? items[0]?.title ?? "";

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setExpanded(true);
          }
        }}
        className="group relative shrink-0 text-left cursor-pointer w-[120px] sm:w-[140px] md:w-[170px] lg:w-[190px] xl:w-[210px] focus:outline-none"
        title={`${label} — ${items.length} items`}
        aria-label={`${label} — ${items.length} items`}
      >
        <div className="relative aspect-[2/3]">
          {top3
            .slice()
            .reverse()
            .map((it, revIdx) => {
              const i = top3.length - 1 - revIdx; // 0 = frontmost card in top3
              const depth = i;
              const lean = depth === 0 ? 0 : depth % 2 === 0 ? 3 : -3;
              return (
                <motion.div
                  key={it.id}
                  className="absolute inset-0 rounded-lg overflow-hidden border border-white/10 bg-white/5"
                  initial={false}
                  animate={{
                    rotate: lean * depth,
                    x: lean * depth * 2,
                    y: depth * -6,
                    scale: 1 - depth * 0.05,
                  }}
                  whileHover={
                    depth === 0
                      ? { scale: 1.06, transition: { duration: 0.18, ease: EASE } }
                      : undefined
                  }
                  transition={{ duration: 0.24, ease: EASE }}
                  style={{ zIndex: 10 - depth, transformOrigin: "50% 85%" }}
                >
                  {it.posterUrl ? (
                    <img
                      src={it.posterUrl}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                      draggable={false}
                    />
                  ) : (
                    <div className="h-full w-full bg-black/30" />
                  )}
                  {depth > 0 && <div className="absolute inset-0 bg-black/40" />}
                </motion.div>
              );
            })}

          {/* count badge */}
          <div className="absolute top-2 right-2 z-20 h-6 min-w-[24px] px-1.5 rounded-full bg-black/70 border border-white/15 backdrop-blur-sm flex items-center justify-center text-[11px] font-semibold">
            {items.length}
          </div>

          {/* bottom label */}
          <div className="absolute inset-x-0 bottom-0 z-20 p-2.5">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
            <div className="relative text-sm font-semibold leading-tight line-clamp-2 drop-shadow">
              {label}
            </div>
            <div className="relative text-[11px] opacity-80 mt-0.5 drop-shadow">
              {items.length} entries
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={() => setExpanded(false)}
          >
            <motion.div
              className="w-full max-w-3xl max-h-[80vh] overflow-y-auto rounded-3xl border border-white/10 bg-[#0b0b10] p-5"
              initial={{ y: 18, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 18, opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.22, ease: EASE }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="text-lg font-semibold">{label}</div>
                <button
                  className="text-sm opacity-70 hover:opacity-100 px-3 py-2 rounded-xl hover:bg-white/10 transition"
                  onClick={() => setExpanded(false)}
                >
                  Close
                </button>
              </div>
              <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(140px,1fr))]">
                {items.map((it) => (
                  <MediaCard
                    key={it.id}
                    item={it}
                    variant="tile"
                    onOpen={() => {
                      setExpanded(false);
                      onOpenItem(it);
                    }}
                    onDelete={onDeleteItem}
                  />
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
