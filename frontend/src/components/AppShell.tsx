import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { SearchModal } from "./SearchModal";
import { fetchAccountPreferences } from "../app/api";
import type { MediaType, ProviderSearchResult } from "../types";
import type { Region } from "../lib/regions";

type SearchOptions = { mediaTypeFilter?: MediaType; region?: Region; initialItem?: ProviderSearchResult };
type SearchContextValue = { openSearch: (options?: SearchOptions) => void };
const SearchContext = createContext<SearchContextValue | null>(null);

export function useAppSearch() {
  const context = useContext(SearchContext);
  if (!context) throw new Error("useAppSearch must be used within AppShell");
  return context;
}

function Icon({ name, className = "" }: { name: string; className?: string }) {
  const paths: Record<string, string> = {
    home: "M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z",
    video_library: "M4 5h16v15H4z M8 9h8 M8 12h8 M8 15h5",
    explore: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z M15.8 8.2 13 13l-4.8 2.8L11 11z",
    format_list_bulleted: "M9 6h12 M9 12h12 M9 18h12 M4 6h.01 M4 12h.01 M4 18h.01",
    person: "M20 21a8 8 0 0 0-16 0 M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z",
    search: "M20 20l-4.5-4.5 M18 10.5a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z",
    add: "M12 5v14 M5 12h14",
  };
  return (
    <svg className={`h-6 w-6 ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[name] ?? paths.explore} />
    </svg>
  );
}

export function AppShell() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchOptions, setSearchOptions] = useState<SearchOptions>({});
  const location = useLocation();
  const [dockHidden, setDockHidden] = useState(false);
  const lastScrollY = useRef(0);
  const { isError: preferencesError } = useQuery({
    queryKey: ["account-preferences"],
    queryFn: fetchAccountPreferences,
  });

  const openSearch = useCallback((options: SearchOptions = {}) => {
    setSearchOptions(options);
    setSearchOpen(true);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.matches("input, textarea, select, [contenteditable=true]");
      if (event.key === "/" && !typing) {
        event.preventDefault();
        openSearch();
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openSearch();
      }
      if (event.key === "Escape") setSearchOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openSearch]);

  useEffect(() => {
    setSearchOpen(false);
    setSearchOptions({});
  }, [location.pathname]);

  useEffect(() => {
    const onScroll = () => {
      const current = window.scrollY;
      if (Math.abs(current - lastScrollY.current) > 8) {
        setDockHidden(current > lastScrollY.current && current > 120);
        lastScrollY.current = current;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const updateVisibility = () => { root.dataset.pageHidden = String(document.visibilityState !== "visible"); };
    const moveAura = (event: PointerEvent) => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      root.style.setProperty("--pointer-x", `${Math.round((event.clientX / window.innerWidth) * 100)}%`);
      root.style.setProperty("--pointer-y", `${Math.round((event.clientY / window.innerHeight) * 100)}%`);
    };
    document.addEventListener("visibilitychange", updateVisibility);
    window.addEventListener("pointermove", moveAura, { passive: true });
    updateVisibility();
    return () => {
      document.removeEventListener("visibilitychange", updateVisibility);
      window.removeEventListener("pointermove", moveAura);
      delete root.dataset.pageHidden;
      root.style.removeProperty("--pointer-x");
      root.style.removeProperty("--pointer-y");
    };
  }, []);

  return (
    <SearchContext.Provider value={{ openSearch }}>
    <div className="app-aura min-h-screen bg-[var(--bg)] pb-28 text-[var(--tx)]">
      <header className="absolute right-4 top-4 z-20 md:right-8 md:top-6">
        <button
          type="button"
          onClick={() => openSearch()}
          className="grid h-11 w-11 place-items-center rounded-full border border-[var(--line2)] bg-[var(--s1)]/85 text-[var(--tx2)] shadow-lg backdrop-blur"
          aria-label="Search films, shows, anime and books"
          title="Search ( / or Ctrl+K )"
        >
          <Icon name="search" className="text-[22px]" />
        </button>
      </header>
      <main key={location.pathname} className="app-main min-h-screen page-enter">
        {preferencesError ? (
          <div role="alert" className="mx-auto max-w-[1440px] px-5 pt-4 text-sm text-[var(--err)] md:px-10">
            Couldn't load account content preferences. Adult titles remain hidden until preferences are available.
          </div>
        ) : null}
        <Outlet />
      </main>

      <nav
        aria-label="Primary"
        className={`app-dock fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-full border border-[var(--line2)] bg-[var(--s1)]/90 p-1.5 shadow-2xl backdrop-blur-xl transition-transform duration-300 ${dockHidden ? "translate-y-24" : "translate-y-0"}`}
      >
        {[
          { to: "/", label: "Home", icon: "home", end: true },
          { to: "/library", label: "Library", icon: "video_library" },
          { to: "/discover", label: "Discover", icon: "explore" },
          { to: "/lists", label: "Lists", icon: "format_list_bulleted" },
          { to: "/you", label: "You", icon: "person" },
        ].map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={"end" in item ? item.end : false}
            className={({ isActive }) =>
              `app-dock-link group flex h-12 w-12 items-center justify-center gap-2 overflow-hidden rounded-full text-[var(--tx2)] no-underline transition-all duration-200 hover:w-[7.5rem] hover:bg-[var(--s2)] hover:text-[var(--tx)] ${isActive ? "bg-[var(--acc)] text-[var(--bg)]" : ""}`
            }
            aria-label={item.label}
          >
            <Icon name={item.icon} className="shrink-0 text-[22px]" />
            <span className="max-w-0 overflow-hidden whitespace-nowrap text-sm font-semibold opacity-0 transition-all group-hover:max-w-20 group-hover:opacity-100">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <button
        type="button"
        onClick={() => openSearch()}
        aria-label="Add a title"
        className="fixed bottom-[max(5.8rem,calc(env(safe-area-inset-bottom)+4.8rem))] right-5 z-30 grid h-14 w-14 place-items-center rounded-full bg-[var(--acc)] text-[var(--bg)] shadow-xl shadow-[var(--acc)]/20 transition-transform hover:scale-105 active:scale-95 md:bottom-8 md:right-8"
      >
        <Icon name="add" className="text-[30px]" />
      </button>

      <SearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        mediaTypeFilter={searchOptions.mediaTypeFilter}
        region={searchOptions.region}
        initialItem={searchOptions.initialItem}
      />
    </div>
    </SearchContext.Provider>
  );
}
