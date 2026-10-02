import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { SearchModal } from "./SearchModal";
import { fetchAccountPreferences, lock } from "../app/api";
import type { MediaType } from "../types";
import type { Region } from "../lib/regions";

type SearchOptions = { mediaTypeFilter?: MediaType; region?: Region };
type SearchContextValue = { openSearch: (options?: SearchOptions) => void };
const SearchContext = createContext<SearchContextValue | null>(null);

export function useAppSearch() {
  const context = useContext(SearchContext);
  if (!context) throw new Error("useAppSearch must be used within AppShell");
  return context;
}

const primaryLinks = [
  { to: "/", label: "Home", icon: "home", end: true },
  { to: "/library", label: "Library", icon: "video_library" },
  { to: "/lists", label: "Lists", icon: "format_list_bulleted" },
  { to: "/diary", label: "Diary", icon: "calendar_month" },
  { to: "/you", label: "You", icon: "person" },
];

const libraryLinks = [
  { to: "/category/MOVIE", label: "Movies" },
  { to: "/category/TV", label: "TV" },
  { to: "/category/ANIME", label: "Anime" },
  { to: "/category/BOOK", label: "Books" },
  { to: "/region/TR", label: "Turkish Dizi" },
  { to: "/region/PK", label: "Pakistani Dramas" },
  { to: "/region/KR", label: "K-Drama" },
  { to: "/region/EU", label: "European" },
];

function Icon({ name, className = "" }: { name: string; className?: string }) {
  return <span className={`material-symbols-rounded ${className}`} aria-hidden="true">{name}</span>;
}

export function AppShell() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchOptions, setSearchOptions] = useState<SearchOptions>({});
  const location = useLocation();
  const navigate = useNavigate();
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

  async function lockDevice() {
    try {
      await lock();
      window.location.reload();
    } catch (error) {
      console.error("Could not lock this device:", error);
    }
  }

  return (
    <SearchContext.Provider value={{ openSearch }}>
    <div className="min-h-screen bg-[var(--bg)] text-[var(--tx)]">
      <aside className="app-sidebar fixed inset-y-0 left-0 z-30 hidden w-64 flex-col px-3 py-5 md:flex">
        <NavLink to="/" className="mb-8 flex items-center gap-2 px-3 no-underline">
          <span className="text-2xl text-[var(--acc)]" aria-hidden="true">✦</span>
          <span className="font-display text-2xl font-semibold text-[var(--tx)]">Grimoire</span>
        </NavLink>

        <nav aria-label="Main navigation" className="space-y-1">
          {primaryLinks.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className="app-nav-link flex items-center gap-3 rounded-xl px-3 text-sm font-medium no-underline"
              aria-label={item.label}
            >
              <Icon name={item.icon} className="text-[21px]" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-7 flex items-center justify-between px-3 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--tx3)]">
          <span>Library</span>
          <button
            type="button"
            className="grid h-8 w-8 place-items-center rounded-lg text-[var(--tx2)] hover:bg-[var(--s2)]"
            aria-label="Add to library"
            onClick={() => openSearch()}
          >
            <Icon name="add" />
          </button>
        </div>
        <nav aria-label="Library categories" className="mt-1 space-y-0.5">
          {libraryLinks.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex min-h-10 items-center rounded-lg pl-4 pr-3 text-sm no-underline transition-colors ${
                  isActive ? "bg-[var(--s2)] text-[var(--tx)]" : "text-[var(--tx2)] hover:bg-[var(--s2)]"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto space-y-1 border-t border-[var(--line)] pt-4">
          <NavLink to="/settings" className="app-nav-link flex items-center gap-3 rounded-xl px-3 text-sm no-underline">
            <Icon name="settings" className="text-[21px]" /> Settings
          </NavLink>
          <button type="button" onClick={lockDevice} className="app-nav-link flex w-full items-center gap-3 rounded-xl px-3 text-sm">
            <Icon name="lock" className="text-[21px]" /> Lock now
          </button>
        </div>
      </aside>

      <div className="md:pl-64">
        <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[var(--bg)] px-4 py-3 md:px-8">
          <div className="mx-auto flex max-w-[1440px] items-center gap-3">
            <button type="button" onClick={() => navigate("/")} className="flex items-center gap-2 md:hidden">
              <span className="text-xl text-[var(--acc)]" aria-hidden="true">✦</span>
              <span className="font-display text-lg font-semibold">Grimoire</span>
            </button>
            <button
              type="button"
              onClick={() => openSearch()}
              className="ml-auto flex h-11 w-full max-w-xl items-center gap-3 rounded-xl border border-[var(--line2)] bg-[var(--s1)] px-3 text-left text-sm text-[var(--tx3)] md:ml-0"
              aria-label="Search films, shows, anime and books"
            >
              <Icon name="search" className="text-[20px]" />
              <span className="flex-1">Search films, shows, anime, books…</span>
              <kbd className="hidden rounded-md border border-[var(--line)] px-1.5 py-0.5 text-xs md:inline">/</kbd>
            </button>
          </div>
        </header>
        <main className="app-main min-h-[calc(100vh-4rem)]">
          {preferencesError ? (
            <div role="alert" className="mx-auto max-w-[1440px] px-5 pt-4 text-sm text-[var(--err)] md:px-10">
              Couldn't load account content preferences. Adult titles remain hidden until preferences are available.
            </div>
          ) : null}
          <Outlet />
        </main>
      </div>

      <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-[var(--line)] bg-[var(--s1)] px-1 pb-[env(safe-area-inset-bottom)] pt-1 md:hidden">
        {[
          { to: "/", label: "Home", icon: "home", end: true },
          { to: "/library", label: "Library", icon: "video_library" },
          { to: null, label: "Search", icon: "search" },
          { to: "/lists", label: "Lists", icon: "format_list_bulleted" },
          { to: "/you", label: "You", icon: "person" },
        ].map((item) => item.to ? (
          <NavLink
            key={item.label}
            to={item.to}
            end={"end" in item ? item.end : false}
            className="app-nav-link flex min-h-[3.375rem] flex-col items-center justify-center gap-0.5 rounded-lg text-[11px] font-semibold no-underline"
          >
            <Icon name={item.icon} className="text-[23px]" />
            <span>{item.label}</span>
          </NavLink>
        ) : (
          <button
            key={item.label}
            type="button"
            onClick={() => openSearch()}
            className="app-nav-link flex min-h-[3.375rem] flex-col items-center justify-center gap-0.5 rounded-lg text-[11px] font-semibold"
          >
            <Icon name={item.icon} className="text-[23px]" />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <SearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        mediaTypeFilter={searchOptions.mediaTypeFilter}
        region={searchOptions.region}
      />
    </div>
    </SearchContext.Provider>
  );
}
