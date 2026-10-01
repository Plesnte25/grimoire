import React from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { fetchLibrary } from "../app/api";
import type { MediaType } from "../types";

const typeLabel: Record<MediaType, string> = {
  MOVIE: "Movies",
  TV: "Dramas",
  ANIME: "Anime",
  BOOK: "Books",
};

// Each type gets TWO color states (rest vs active) for the “background transitions from one color to different”
const typeTint: Record<MediaType, { rest: string; active: string }> = {
  MOVIE: {
    rest: "radial-gradient(120% 140% at 20% 10%, rgba(99,102,241,0.35) 0%, rgba(0,0,0,0) 55%), linear-gradient(180deg, rgba(0,0,0,0.25), rgba(0,0,0,0.65))",
    active:
      "radial-gradient(120% 140% at 80% 20%, rgba(236,72,153,0.35) 0%, rgba(0,0,0,0) 55%), linear-gradient(180deg, rgba(0,0,0,0.10), rgba(0,0,0,0.75))",
  },
  TV: {
    rest: "radial-gradient(120% 140% at 20% 10%, rgba(16,185,129,0.35) 0%, rgba(0,0,0,0) 55%), linear-gradient(180deg, rgba(0,0,0,0.25), rgba(0,0,0,0.65))",
    active:
      "radial-gradient(120% 140% at 80% 20%, rgba(34,211,238,0.30) 0%, rgba(0,0,0,0) 55%), linear-gradient(180deg, rgba(0,0,0,0.10), rgba(0,0,0,0.75))",
  },
  ANIME: {
    rest: "radial-gradient(120% 140% at 20% 10%, rgba(244,63,94,0.35) 0%, rgba(0,0,0,0) 55%), linear-gradient(180deg, rgba(0,0,0,0.25), rgba(0,0,0,0.65))",
    active:
      "radial-gradient(120% 140% at 80% 20%, rgba(249,115,22,0.30) 0%, rgba(0,0,0,0) 55%), linear-gradient(180deg, rgba(0,0,0,0.10), rgba(0,0,0,0.75))",
  },
  BOOK: {
    rest: "radial-gradient(120% 140% at 20% 10%, rgba(245,158,11,0.30) 0%, rgba(0,0,0,0) 55%), linear-gradient(180deg, rgba(0,0,0,0.25), rgba(0,0,0,0.65))",
    active:
      "radial-gradient(120% 140% at 80% 20%, rgba(234,179,8,0.30) 0%, rgba(0,0,0,0) 55%), linear-gradient(180deg, rgba(0,0,0,0.10), rgba(0,0,0,0.75))",
  },
};

export function BigCategoryCard({
  mediaType,
  stats,
  onOpen,
  isActive,
  anyActive,
  expandOrigin,
}: {
  mediaType: MediaType;
  stats: { total: number; inProgress: number };
  onOpen: () => void;
  isActive: boolean;
  anyActive: boolean;
  expandOrigin: "left" | "center" | "right";
}) {
  const { data: items = [] } = useQuery({
    queryKey: ["library", mediaType],
    queryFn: () => fetchLibrary(mediaType),
    staleTime: 1000 * 60 * 2,
  });

  const posters = items
    .map((i: any) => i.posterUrl)
    .filter(Boolean) as string[];
  const heroPoster = posters[0];

  // Parallax / tilt (only when active)
  const mvX = useMotionValue(0);
  const mvY = useMotionValue(0);

  const rotateY = useTransform(mvX, [-1, 1], [7, -7]);
  const rotateX = useTransform(mvY, [-1, 1], [-6, 6]);
  const posterX = useTransform(mvX, [-1, 1], [-14, 14]);
  const posterY = useTransform(mvY, [-1, 1], [-12, 12]);

  const EASE = [0.22, 1, 0.36, 1] as const;
  const state = isActive ? "active" : "rest";

  function handleMove(e: React.MouseEvent<HTMLElement>) {
    if (!isActive) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    mvX.set((x - 0.5) * 2);
    mvY.set((y - 0.5) * 2);
  }
  function resetTilt() {
    mvX.set(0);
    mvY.set(0);
  }

  const originCss =
    expandOrigin === "left"
      ? "0% 50%"
      : expandOrigin === "right"
      ? "100% 50%"
      : "50% 50%";

  return (
    <motion.div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpen();
      }}
      onMouseMove={handleMove}
      onMouseLeave={resetTilt}
      className="w-full h-full cursor-pointer select-none"
      style={{ perspective: 1200 }}
    >
      <motion.div
        className="relative h-full w-full overflow-hidden rounded-2xl"
        animate={state}
        initial={false}
        transition={{ duration: 0.24, ease: EASE }}
        style={{
          transformOrigin: originCss,
          boxShadow: isActive
            ? "0 28px 70px rgba(0,0,0,0.40)"
            : "0 12px 32px rgba(0,0,0,0.22)",
          transformStyle: "preserve-3d",
          rotateX: isActive ? (rotateX as any) : 0,
          rotateY: isActive ? (rotateY as any) : 0,
          willChange: "transform",
          filter:
            anyActive && !isActive ? "saturate(0.88) brightness(0.92)" : "none",
        }}
      >
        {/* Poster */}
        <motion.div
          className="absolute inset-0"
          variants={{
            rest: { scale: 1, filter: "saturate(1) contrast(1)" },
            active: { scale: 1.12, filter: "saturate(1.06) contrast(1.02)" },
          }}
          transition={{ duration: 0.26, ease: EASE }}
        >
          {heroPoster ? (
            <motion.img
              src={heroPoster}
              alt=""
              className="h-full w-full object-cover"
              style={{
                x: isActive ? (posterX as any) : 0,
                y: isActive ? (posterY as any) : 0,
                willChange: "transform",
              }}
              draggable={false}
            />
          ) : (
            <div className="h-full w-full bg-black/30" />
          )}
        </motion.div>

        {/* Per-card color tint background transition (rest <-> active) */}
        <motion.div
          className="absolute inset-0"
          style={{ background: typeTint[mediaType].rest }}
          animate={{ opacity: isActive ? 0 : 1 }}
          transition={{ duration: 0.22, ease: EASE }}
        />
        <motion.div
          className="absolute inset-0"
          style={{ background: typeTint[mediaType].active }}
          animate={{ opacity: isActive ? 1 : 0 }}
          transition={{ duration: 0.22, ease: EASE }}
        />

        {/* Readability overlay (also shifts on hover) */}
        <motion.div
          className="absolute inset-0"
          animate={{ opacity: isActive ? 0.8 : 0.55 }}
          transition={{ duration: 0.22, ease: EASE }}
          style={{
            background:
              "linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.35) 45%, rgba(0,0,0,0.06) 100%)",
          }}
        />

        {/* Collapsed label (vertical) — visible in sliver state */}
        {/* Collapsed label (vertical) */}
        <motion.div
          className="absolute inset-0 flex items-end justify-center pb-6"
          variants={{
            rest: { opacity: 1 },
            active: { opacity: 0, transition: { duration: 0.14, ease: EASE } },
          }}
        >
          <div className="pointer-events-none flex flex-col items-center gap-3">
            <div
              className="
        text-white/90 font-semibold tracking-wide
        [writing-mode:vertical-rl] rotate-180
        text-base md:text-lg
      "
            >
              {typeLabel[mediaType]}
            </div>

            <div
              className="
        text-[11px] px-2.5 py-1 rounded-full
        bg-white/10 border border-white/10 backdrop-blur-sm
      "
            >
              {stats.total}
            </div>
          </div>
        </motion.div>

        {/* Expanded content reveal (staggered) */}
        <motion.div
          className="absolute inset-x-0 bottom-0 p-5 md:p-6"
          variants={{
            rest: { opacity: 0, y: 22 },
            active: {
              opacity: 1,
              y: 0,
              transition: {
                duration: 0.22,
                ease: EASE,
                staggerChildren: 0.06,
                delayChildren: 0.05,
              },
            },
          }}
          animate={state}
        >
          <motion.div
            variants={{
              rest: { opacity: 0, y: 22 },
              active: {
                opacity: 1,
                y: 0,
                transition: { duration: 0.22, ease: EASE },
              },
            }}
            className="text-2xl md:text-3xl font-semibold tracking-tight"
          >
            {typeLabel[mediaType]}
          </motion.div>

          <motion.div
            variants={{
              rest: { opacity: 0, y: 22 },
              active: {
                opacity: 1,
                y: 0,
                transition: { duration: 0.22, ease: EASE },
              },
            }}
            className="mt-2 text-sm opacity-85"
          >
            {stats.total} in library · {stats.inProgress} in progress
          </motion.div>

          <motion.div
            variants={{
              rest: { opacity: 0, y: 22 },
              active: {
                opacity: 1,
                y: 0,
                transition: { duration: 0.22, ease: EASE },
              },
            }}
            className="mt-4 flex flex-wrap gap-2"
          >
            <span className="text-[11px] px-2.5 py-1 rounded-full bg-white/10 border border-white/10 backdrop-blur-sm">
              ▶ {items.filter((i) => i.status === "IN_PROGRESS").length}
            </span>
            <span className="text-[11px] px-2.5 py-1 rounded-full bg-white/10 border border-white/10 backdrop-blur-sm">
              ✓ {items.filter((i) => i.status === "COMPLETED").length}
            </span>
          </motion.div>
        </motion.div>

        {/* CTA appears only when expanded */}
        <motion.div
          className="absolute right-3 bottom-3"
          animate={{
            opacity: isActive ? 1 : 0,
            y: isActive ? 0 : 10,
            scale: isActive ? 1 : 0.96,
          }}
          transition={{ duration: 0.2, ease: EASE }}
        >
          <button
            className="rounded-full px-3.5 py-2 text-sm bg-white/12 hover:bg-white/18 border border-white/10 backdrop-blur-md transition"
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
          >
            Open →
          </button>
        </motion.div>

        {/* Border glow */}
        <motion.div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          animate={{ opacity: isActive ? 1 : 0 }}
          transition={{ duration: 0.2, ease: EASE }}
          style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.14)" }}
        />
      </motion.div>
    </motion.div>
  );
}
