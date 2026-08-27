import { motion } from "framer-motion";

export function PosterTile({
  title,
  subtitle,
  posterUrl,
  onOpen,
  onQuickAdd,
  showQuickAdd = false,
}: {
  title: string;
  subtitle?: string;
  posterUrl?: string | null;
  onOpen: () => void;
  onQuickAdd?: () => void;
  showQuickAdd?: boolean;
}) {
  return (
    <motion.div
      className="relative w-[120px] sm:w-[140px] md:w-[160px] aspect-[2/3] flex-shrink-0 rounded-xl overflow-hidden cursor-pointer"
      whileHover={{ y: -6, scale: 1.03 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpen();
      }}
    >
      {/* Poster */}
      {posterUrl ? (
        <motion.img
          src={posterUrl}
          alt={title}
          className="absolute inset-0 h-full w-full object-cover"
          initial={false}
          whileHover={{ scale: 1.08 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          draggable={false}
        />
      ) : (
        <div className="absolute inset-0 bg-white/10" />
      )}

      {/* Gradient overlay for text */}
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0.35 }}
        whileHover={{ opacity: 0.75 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.35) 45%, rgba(0,0,0,0.05) 100%)",
        }}
      />

      {/* Text */}
      <motion.div
        className="absolute inset-x-0 bottom-0 p-3"
        initial={{ y: 14, opacity: 0 }}
        whileHover={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="text-sm font-semibold leading-tight line-clamp-2">
          {title}
        </div>
        {subtitle ? (
          <div className="text-xs opacity-75 mt-1 line-clamp-1">{subtitle}</div>
        ) : null}
      </motion.div>

      {/* Quick add button */}
      {showQuickAdd && onQuickAdd ? (
        <motion.button
          type="button"
          aria-label="Quick add"
          className="absolute top-2 right-2 rounded-full bg-black/40 backdrop-blur px-2 py-1 text-xs border border-white/15 hover:bg-black/55"
          initial={{ opacity: 0, scale: 0.95 }}
          whileHover={{ opacity: 1, scale: 1 }}
          onClick={(e) => {
            e.stopPropagation();
            onQuickAdd();
          }}
        >
          + Add
        </motion.button>
      ) : null}
    </motion.div>
  );
}
