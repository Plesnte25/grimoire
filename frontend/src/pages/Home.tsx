import { useMemo, useState } from "react";
import { BigCategoryCard } from "../components/BigCategoryCard";
import { REGIONS, effectiveRegion, isRegion, type CategoryKey } from "../lib/regions";
import { SearchModal } from "../components/SearchModal";
import { useQuery } from "@tanstack/react-query";
import { fetchLibrary } from "../app/api";
import type { MediaItem, MediaType } from "../types";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const TYPES: MediaType[] = ["MOVIE", "TV", "ANIME", "BOOK"];
const CATEGORIES: CategoryKey[] = [...TYPES, ...REGIONS];

function categoryHref(c: CategoryKey) {
  return isRegion(c) ? `/region/${c}` : `/category/${c}`;
}

/** Minimal inline icons (no deps) */
function IconPlus(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
function IconCalendar({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </svg>
  );
}

function IconList(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M9 6h12M9 12h12M9 18h12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M4.5 6h.01M4.5 12h.01M4.5 18h.01"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
function IconGear(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M19.4 15a7.9 7.9 0 0 0 .1-1 7.9 7.9 0 0 0-.1-1l2-1.6-2-3.4-2.4 1a8.2 8.2 0 0 0-1.7-1l-.4-2.6H9.1l-.4 2.6a8.2 8.2 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7.9 7.9 0 0 0-.1 1c0 .34.03.67.1 1l-2 1.6 2 3.4 2.4-1c.52.4 1.1.74 1.7 1l.4 2.6h5.8l.4-2.6c.6-.26 1.18-.6 1.7-1l2.4 1 2-3.4-2-1.6Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Home() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const nav = useNavigate();

  const { data: all = [] } = useQuery({
    queryKey: ["library", "all"],
    queryFn: () => fetchLibrary(),
  });

  // Same rules as the server: regional shows leave TV, regional films stay in
  // Movies as well as their region.
  const stats = useMemo(() => {
    const map = new Map<CategoryKey, { total: number; inProgress: number }>();
    for (const c of CATEGORIES) map.set(c, { total: 0, inProgress: 0 });
    const bump = (c: CategoryKey, it: MediaItem) => {
      const s = map.get(c);
      if (!s) return;
      s.total += 1;
      if (it.status === "IN_PROGRESS") s.inProgress += 1;
    };
    for (const it of all) {
      const region = it.mediaType === "TV" || it.mediaType === "MOVIE" ? effectiveRegion(it) : null;
      if (region) bump(region, it);
      if (!(region && it.mediaType === "TV")) bump(it.mediaType as MediaType, it);
    }
    return map;
  }, [all]);

  const EASE = [0.22, 1, 0.36, 1] as const;
  const n = CATEGORIES.length;

  // Accordion feel knobs (desktop)
  const SLIVER_PX = 60; // thin closed state
  const HEIGHT = "78vh";
  const MIN_H = 640;
  const MAX_H = 860;

  return (
    <div className="h-screen w-full px-4 md:px-6 py-4 overflow-hidden">
      {/* Top-right minimalist icon CTAs */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
        <button
          aria-label="Add"
          title="Add"
          className="glass rounded-full p-3 hover:bg-white/12 transition"
          onClick={() => setSearchOpen(true)}
        >
          <IconPlus className="h-5 w-5 opacity-90" />
        </button>

        <button
          aria-label="Lists"
          title="Lists"
          className="glass rounded-full p-3 hover:bg-white/12 transition"
          onClick={() => nav("/lists")}
        >
          <IconList className="h-5 w-5 opacity-90" />
        </button>

        <button
          aria-label="Diary"
          title="Diary"
          className="glass rounded-full p-3 hover:bg-white/12 transition"
          onClick={() => nav("/diary")}
        >
          <IconCalendar className="h-5 w-5 opacity-90" />
        </button>

        <button
          aria-label="Settings"
          title="Settings"
          className="glass rounded-full p-3 hover:bg-white/12 transition"
          onClick={() => nav("/settings")}
        >
          <IconGear className="h-5 w-5 opacity-90" />
        </button>
      </div>

      {/* CENTER the grid vertically + horizontally (reference-like) */}
      <div className="pt-14 md:pt-0 min-h-[calc(100vh-1rem)] md:min-h-screen flex items-center justify-center">
        <div className="relative w-full">
          {/* Edge fades (nice, subtle) */}
          <div className="pointer-events-none absolute left-0 top-0 h-full w-10 md:w-16 bg-gradient-to-r from-[#0b0b10] to-transparent z-10" />
          <div className="pointer-events-none absolute right-0 top-0 h-full w-10 md:w-16 bg-gradient-to-l from-[#0b0b10] to-transparent z-10" />

          {/* MOBILE (scrollable, no scrollbar) */}
          <div
            className="
              md:hidden
              w-full flex items-stretch gap-4
              overflow-x-auto py-6
              [-ms-overflow-style:none]
              [scrollbar-width:none]
              [&::-webkit-scrollbar]:hidden
            "
          >
            {CATEGORIES.map((t, i) => (
              <div
                key={t}
                className="flex-shrink-0 w-[78vw] max-w-[340px] h-[62vh] min-h-[520px]"
              >
                <BigCategoryCard
                  category={t}
                  stats={stats.get(t)!}
                  isActive={true} // always expanded on mobile
                  anyActive={false}
                  expandOrigin="center"
                  onOpen={() => nav(categoryHref(t))}
                />
              </div>
            ))}
          </div>

          {/* DESKTOP (true accordion) */}
          <div
            className="hidden md:flex w-full items-stretch gap-4 overflow-hidden py-10"
            style={{ height: HEIGHT, minHeight: MIN_H, maxHeight: MAX_H }}
            onMouseLeave={() => setActiveIndex(null)}
          >
            {CATEGORIES.map((t, i) => {
              const isActive = activeIndex === i;
              const anyActive = activeIndex !== null;

              // Smart-animate style: active expands, others collapse to slivers.
              // Using flexGrow weights guarantees sibling shrinking.
              const flexGrow = activeIndex === null ? 1 : isActive ? 2 : 1;

              return (
                <motion.div
                  key={t}
                  className="min-w-0 h-full"
                  onMouseEnter={() => setActiveIndex(i)}
                  animate={{
                    flexGrow,
                    flexBasis:
                      activeIndex === null ? 0 : isActive ? 0 : SLIVER_PX,
                  }}
                  transition={{ duration: 0.26, ease: EASE }}
                  style={{
                    display: "flex",
                    flexShrink: 1,
                    flexBasis: 0,
                    // When accordion is active, keep collapsed items thin:
                    minWidth: anyActive && !isActive ? SLIVER_PX : 160,
                  }}
                >
                  <BigCategoryCard
                    category={t}
                    stats={stats.get(t)!}
                    isActive={isActive}
                    anyActive={anyActive}
                    expandOrigin={
                      i === 0 ? "left" : i === n - 1 ? "right" : "center"
                    }
                    onOpen={() => nav(categoryHref(t))}
                  />
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
