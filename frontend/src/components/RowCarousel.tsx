import { useRef } from "react";

export function RowCarousel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  function scrollBy(px: number) {
    ref.current?.scrollBy({ left: px, behavior: "smooth" });
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between px-2 md:px-0">
        <div className="text-sm md:text-base font-semibold opacity-90">
          {title}
        </div>

        <div className="hidden md:flex gap-2">
          <button
            className="rounded-full p-2 bg-white/5 hover:bg-white/10 border border-white/10"
            aria-label="Scroll left"
            onClick={() => scrollBy(-520)}
          >
            ←
          </button>
          <button
            className="rounded-full p-2 bg-white/5 hover:bg-white/10 border border-white/10"
            aria-label="Scroll right"
            onClick={() => scrollBy(520)}
          >
            →
          </button>
        </div>
      </div>

      <div className="mt-3 relative">
        {/* Edge fades (Netflix-ish) */}
        <div className="pointer-events-none absolute left-0 top-0 h-full w-8 md:w-12 bg-gradient-to-r from-[#0b0b10] to-transparent z-10" />
        <div className="pointer-events-none absolute right-0 top-0 h-full w-8 md:w-12 bg-gradient-to-l from-[#0b0b10] to-transparent z-10" />

        <div
          ref={ref}
          className="
            flex gap-3 md:gap-4 overflow-x-auto pb-2
            px-2 md:px-0
            [scrollbar-width:none] [-ms-overflow-style:none]
          "
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {/* Hide webkit scrollbar */}
          <style>{`div::-webkit-scrollbar{display:none;}`}</style>
          {children}
        </div>
      </div>
    </div>
  );
}
