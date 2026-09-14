import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MediaItem } from "../types";
import {
  addItemToList,
  createList,
  deleteLibraryItem,
  fetchLibrary,
  fetchLists,
  fetchTrackMeta,
  updateItem,
} from "../app/api";
import { SuggestionsCarousel } from "../components/SuggestionsCarousel";
import { SearchModal } from "../components/SearchModal";

type Tab = "library" | "playlists" | "explore";
type RepeatMode = "OFF" | "ALL" | "ONE";

function safeParseGenres(genres: string | null | undefined): string[] {
  if (!genres) return [];
  try {
    const arr = JSON.parse(genres);
    return Array.isArray(arr) ? arr.filter(Boolean).map(String) : [];
  } catch {
    return [];
  }
}

function parseArtist(desc: string | null | undefined) {
  // your itunes mapping uses "By <artist>"
  if (!desc) return "";
  const m = desc.match(/^By\s(.+)$/i);
  return m ? m[1] : desc;
}

function formatTime(sec: number) {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function MusicCategory() {
  const nav = useNavigate();
  const qc = useQueryClient();

  const [tab, setTab] = useState<Tab>("library");
  const [searchOpen, setSearchOpen] = useState(false);

  // Player state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>("OFF");
  const [progress, setProgress] = useState(0); // seconds
  const [duration, setDuration] = useState(0); // seconds

  // UI state
  const [activeGenre, setActiveGenre] = useState<string>("All");
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const [lyricsDraft, setLyricsDraft] = useState("");
  const [queue, setQueue] = useState<string[]>([]); // array of media ids in play order
  const [playerMeta, setPlayerMeta] = useState<{
    artist?: string;
    album?: string;
    previewUrl?: string;
    artwork?: string;
  } | null>(null);

  // Library
  const { data: library = [] } = useQuery({
    queryKey: ["library", "MUSIC"],
    queryFn: () => fetchLibrary("MUSIC"),
  });

  // Lists (playlists)
  const { data: lists = [] } = useQuery({
    queryKey: ["lists"],
    queryFn: () => fetchLists(),
  });

  // Suggestions should not show anything already in library
  const existingProviderIds = useMemo(() => {
    return new Set(
      library
        .filter((it) => it.provider && it.providerId)
        .map((it) => `${String(it.provider)}:${String(it.providerId)}`)
    );
  }, [library]);

  // Build genres from library
  const allGenres = useMemo(() => {
    const set = new Set<string>();
    for (const s of library) {
      const gs = safeParseGenres(s.genres);
      for (const g of gs) set.add(g);
    }
    const arr = Array.from(set).sort((a, b) => a.localeCompare(b));
    return ["All", ...(arr.length ? arr : []), "Unknown"];
  }, [library]);

  // Filtered library for list view
  const filteredLibrary = useMemo(() => {
    if (activeGenre === "All") return library;
    if (activeGenre === "Unknown") {
      return library.filter((s) => safeParseGenres(s.genres).length === 0);
    }
    return library.filter((s) =>
      safeParseGenres(s.genres).includes(activeGenre)
    );
  }, [library, activeGenre]);

  // Current song object
  const currentSong = useMemo(() => {
    return library.find((x) => x.id === currentId) ?? null;
  }, [library, currentId]);

  // Mutations
  const removeMutation = useMutation({
    mutationFn: (id: string) => deleteLibraryItem(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["library", "MUSIC"] });
    },
  });

  const lyricsMutation = useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) =>
      updateItem(id, { yourNotes: text }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["library", "MUSIC"] });
    },
  });

  const addToPlaylistMutation = useMutation({
    mutationFn: async ({
      mediaId,
      listName,
    }: {
      mediaId: string;
      listName: string;
    }) => {
      const trimmed = listName.trim();
      if (!trimmed) throw new Error("Playlist name required.");

      // find existing list (case-insensitive)
      const existing = lists.find(
        (l) => l.name.toLowerCase() === trimmed.toLowerCase()
      );
      const list =
        existing ??
        (await createList({ name: trimmed, description: "Music playlist" }));
      await addItemToList(list.id, mediaId);
      return true;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lists"] });
    },
  });

  // Create audio element once
  useEffect(() => {
    if (!audioRef.current) audioRef.current = new Audio();
    const audio = audioRef.current;

    const onTime = () => setProgress(audio.currentTime || 0);
    const onMeta = () => setDuration(audio.duration || 0);
    const onEnded = () => handleEnded();

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnded);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Maintain queue (filtered order) and keep current in it
  useEffect(() => {
    const ids = filteredLibrary.map((s) => s.id);
    setQueue(ids);

    if (ids.length && !currentId) {
      // auto select first song but don't autoplay
      setCurrentId(ids[0]);
    } else if (currentId && !ids.includes(currentId)) {
      // current song got filtered out or removed
      setCurrentId(ids[0] ?? null);
      setIsPlaying(false);
    }
  }, [filteredLibrary, currentId]);

  // Load song into player when currentId changes
  useEffect(() => {
    async function load() {
      if (!currentSong || !audioRef.current) return;

      const meta = await fetchTrackMeta(String(currentSong.providerId));
      setPlayerMeta({
        artist: meta?.artistName ?? parseArtist(currentSong.description),
        album: meta?.collectionName ?? "",
        previewUrl: meta?.previewUrl,
        artwork: meta?.artworkUrl100 ?? currentSong.posterUrl ?? undefined,
      });

      const audio = audioRef.current;
      // if no preview, just pause and keep selected
      if (!meta?.previewUrl) {
        audio.pause();
        setIsPlaying(false);
        setProgress(0);
        setDuration(0);
        return;
      }

      audio.src = meta.previewUrl;
      audio.currentTime = 0;
      setProgress(0);

      // Autoplay if previously in play state
      if (isPlaying) {
        try {
          await audio.play();
        } catch {
          setIsPlaying(false);
        }
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId]);

  async function playPause() {
    const audio = audioRef.current;
    if (!audio || !currentSong) return;

    // If no src yet, attempt to load by toggling play state
    if (!audio.src) {
      setIsPlaying(true);
      return;
    }

    if (audio.paused) {
      try {
        await audio.play();
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
      }
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }

  function cycleRepeat() {
    setRepeat((r) => (r === "OFF" ? "ALL" : r === "ALL" ? "ONE" : "OFF"));
  }

  function currentIndex() {
    if (!currentId) return -1;
    return queue.indexOf(currentId);
  }

  function pickNextIndex() {
    if (queue.length === 0) return -1;
    const idx = currentIndex();
    if (shuffle) {
      if (queue.length === 1) return idx;
      let n = idx;
      while (n === idx) n = Math.floor(Math.random() * queue.length);
      return n;
    }
    return idx + 1;
  }

  function pickPrevIndex() {
    if (queue.length === 0) return -1;
    const idx = currentIndex();
    if (shuffle) {
      if (queue.length === 1) return idx;
      let n = idx;
      while (n === idx) n = Math.floor(Math.random() * queue.length);
      return n;
    }
    return idx - 1;
  }

  async function next() {
    if (queue.length === 0) return;
    const idx = pickNextIndex();
    if (idx >= 0 && idx < queue.length) {
      setCurrentId(queue[idx]);
      setIsPlaying(true);
    } else {
      // end reached
      if (repeat === "ALL") {
        setCurrentId(queue[0]);
        setIsPlaying(true);
      } else {
        setIsPlaying(false);
      }
    }
  }

  async function prev() {
    if (queue.length === 0) return;
    const idx = pickPrevIndex();
    if (idx >= 0 && idx < queue.length) {
      setCurrentId(queue[idx]);
      setIsPlaying(true);
    } else {
      // start reached
      if (repeat === "ALL") {
        setCurrentId(queue[queue.length - 1]);
        setIsPlaying(true);
      } else {
        // restart track
        const audio = audioRef.current;
        if (audio) audio.currentTime = 0;
      }
    }
  }

  async function handleEnded() {
    if (repeat === "ONE") {
      const audio = audioRef.current;
      if (!audio) return;
      audio.currentTime = 0;
      try {
        await audio.play();
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
      }
      return;
    }
    await next();
  }

  function onSeek(v: number) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = v;
    setProgress(v);
  }

  function openLyrics(song: MediaItem) {
    setLyricsDraft(song.yourNotes ?? "");
    setLyricsOpen(true);
    setCurrentId(song.id);
  }

  function saveLyrics() {
    if (!currentSong) return;
    lyricsMutation.mutate({ id: currentSong.id, text: lyricsDraft });
  }

  async function addToPlaylist(song: MediaItem) {
    const name = window.prompt("Add to playlist (type playlist name):");
    if (!name) return;
    addToPlaylistMutation.mutate({ mediaId: song.id, listName: name });
  }

  const headerTitle =
    tab === "library"
      ? "Your Library"
      : tab === "playlists"
      ? "Playlists"
      : "Discover";
  const headerSubtitle =
    tab === "library"
      ? `${library.length} songs · ${filteredLibrary.length} shown`
      : tab === "playlists"
      ? `${lists.length} playlists`
      : "Fresh picks to add — refresh anytime";

  return (
    <div className="min-h-screen px-4 md:px-10 py-6 pb-28">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <button
          className="text-sm opacity-70 hover:opacity-100"
          onClick={() => nav("/")}
        >
          ← Back
        </button>

        <div className="flex items-center gap-2">
          <button
            className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 transition text-sm"
            onClick={() => setSearchOpen(true)}
            title="Add songs"
          >
            + Add
          </button>
        </div>
      </div>

      {/* Hero */}
      <div className="mt-5 rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-3xl md:text-4xl font-semibold tracking-tight">
              MUSIC
            </div>
            <div className="text-sm opacity-70 mt-1">{headerSubtitle}</div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-2 flex-wrap">
            {(["library", "playlists", "explore"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={[
                  "px-3 py-2 rounded-xl text-sm border transition",
                  tab === t
                    ? "bg-white/15 border-white/20"
                    : "bg-white/5 hover:bg-white/10 border-white/10",
                ].join(" ")}
              >
                {t === "library"
                  ? "Library"
                  : t === "playlists"
                  ? "Playlists"
                  : "Explore"}
              </button>
            ))}
          </div>
        </div>

        {/* Genre Filter */}
        <div className="mt-4 flex flex-wrap gap-2">
          {allGenres.map((g) => (
            <button
              key={g}
              onClick={() => setActiveGenre(g)}
              className={[
                "px-3 py-1.5 rounded-full text-xs border transition",
                activeGenre === g
                  ? "bg-white/15 border-white/25"
                  : "bg-white/5 hover:bg-white/10 border-white/10 opacity-90",
              ].join(" ")}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* Suggestions */}
      <div className="mt-6">
        <SuggestionsCarousel
          mediaType="MUSIC"
          existingProviderIds={existingProviderIds}
          scope={tab === "explore" ? "discover" : undefined}
          subtitle={
            tab === "explore"
              ? "Discover trending-ish picks — hit Refresh for a fresh batch."
              : "Quick add similar songs — added songs never appear again."
          }
        />
      </div>

      {/* Main content */}
      <div className="mt-6">
        {tab === "playlists" ? (
          <div className="grid md:grid-cols-2 gap-4">
            {lists.length === 0 ? (
              <div className="text-sm opacity-70">
                No playlists yet. Add a song → “Add to playlist”.
              </div>
            ) : (
              lists.map((l) => (
                <div
                  key={l.id}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{l.name}</div>
                      <div className="text-xs opacity-60 mt-1">
                        {l.items?.length ?? 0} songs
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 space-y-2">
                    {(l.items ?? []).slice(0, 8).map((it) => (
                      <button
                        key={it.id}
                        className="w-full text-left rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition p-2 flex items-center gap-3"
                        onClick={() => {
                          setCurrentId(it.media.id);
                          setIsPlaying(true);
                        }}
                      >
                        <img
                          src={it.media.posterUrl ?? ""}
                          alt=""
                          className="h-10 w-10 rounded-lg object-cover bg-white/5"
                          onError={(e) =>
                            (e.currentTarget.style.display = "none")
                          }
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">
                            {it.media.title}
                          </div>
                          <div className="text-xs opacity-60 truncate">
                            {parseArtist(it.media.description)}
                          </div>
                        </div>
                      </button>
                    ))}
                    {(l.items?.length ?? 0) > 8 && (
                      <div className="text-xs opacity-60">…and more</div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="rounded-3xl border border-white/10 bg-white/5 overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <div className="font-semibold">{headerTitle}</div>
              <div className="text-xs opacity-60">
                {shuffle ? "Shuffle on" : "Shuffle off"} · Repeat {repeat}
              </div>
            </div>

            {filteredLibrary.length === 0 ? (
              <div className="p-6 text-sm opacity-70">
                No songs in this view. Add songs with “+ Add” or change genre.
              </div>
            ) : (
              <div className="divide-y divide-white/10">
                {filteredLibrary.map((s) => {
                  const isCurrent = s.id === currentId;
                  return (
                    <div
                      key={s.id}
                      className={[
                        "group flex flex-wrap items-center gap-3 px-4 py-3 transition",
                        isCurrent ? "bg-white/10" : "hover:bg-white/7",
                      ].join(" ")}
                    >
                      {/* artwork */}
                      <div className="h-12 w-12 rounded-xl bg-white/5 border border-white/10 overflow-hidden shrink-0">
                        {s.posterUrl ? (
                          <img
                            src={s.posterUrl}
                            alt=""
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-[10px] opacity-60">
                            art
                          </div>
                        )}
                      </div>

                      {/* title/artist */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-semibold truncate">
                            {s.title}
                          </div>
                          {isCurrent && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/15 border border-white/15 opacity-90">
                              {isPlaying ? "Playing" : "Selected"}
                            </span>
                          )}
                        </div>
                        <div className="text-xs opacity-60 truncate">
                          {parseArtist(s.description)}{" "}
                          {safeParseGenres(s.genres).length
                            ? `· ${safeParseGenres(s.genres)
                                .slice(0, 2)
                                .join(", ")}`
                            : ""}
                        </div>
                      </div>

                      {/* row actions */}
                      <div className="flex items-center gap-2 w-full md:w-auto justify-end mt-2 md:mt-0">
                        <button
                          className="px-3 py-1.5 rounded-xl text-xs bg-white/10 hover:bg-white/15 border border-white/10 transition"
                          onClick={() => {
                            if (s.id === currentId) {
                              playPause();
                            } else {
                              setCurrentId(s.id);
                              setIsPlaying(true);
                            }
                          }}
                          title="Play / Pause"
                        >
                          {s.id === currentId && isPlaying ? "Pause" : "Play"}
                        </button>

                        <button
                          className="px-3 py-1.5 rounded-xl text-xs bg-white/5 hover:bg-white/10 border border-white/10 transition"
                          onClick={() => addToPlaylist(s)}
                          title="Add to playlist"
                        >
                          + Playlist
                        </button>

                        <button
                          className="px-3 py-1.5 rounded-xl text-xs bg-white/5 hover:bg-white/10 border border-white/10 transition"
                          onClick={() => openLyrics(s)}
                          title="Lyrics"
                        >
                          Lyrics
                        </button>

                        <button
                          className="px-3 py-1.5 rounded-xl text-xs bg-white/5 hover:bg-red-500/15 border border-white/10 transition"
                          onClick={() => {
                            if (
                              window.confirm(
                                `Remove "${s.title}" from library?`
                              )
                            ) {
                              removeMutation.mutate(s.id);
                              if (s.id === currentId) {
                                setIsPlaying(false);
                                setCurrentId(null);
                              }
                            }
                          }}
                          title="Remove"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lyrics drawer */}
      {lyricsOpen && currentSong && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end md:items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-[#0b0b0f] overflow-hidden">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div>
                <div className="font-semibold">{currentSong.title}</div>
                <div className="text-xs opacity-60">
                  {parseArtist(currentSong.description)}
                </div>
              </div>
              <button
                className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 transition text-sm"
                onClick={() => setLyricsOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="p-4">
              <div className="text-xs opacity-60 mb-2">
                Paste lyrics here (stored as notes for this song).
              </div>
              <textarea
                className="w-full h-60 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm outline-none focus:ring-2 focus:ring-white/15"
                value={lyricsDraft}
                onChange={(e) => setLyricsDraft(e.target.value)}
                placeholder="Lyrics..."
              />
              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 transition text-sm"
                  onClick={() => setLyricsOpen(false)}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 rounded-xl bg-white/15 hover:bg-white/20 border border-white/10 transition text-sm"
                  onClick={() => {
                    saveLyrics();
                    setLyricsOpen(false);
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom player bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40">
        <div className="mx-auto max-w-[1200px] px-4 md:px-10 pb-4">
          <div className="relative rounded-3xl border border-white/10 bg-[#0b0b0f]/90 backdrop-blur-xl shadow-2xl shadow-black/50 overflow-hidden">
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-60"
              style={{
                background:
                  "linear-gradient(90deg, transparent, rgba(139,92,246,0.8), rgba(56,189,248,0.6), transparent)",
              }}
            />
            <div className="p-3 md:p-4 flex items-center gap-3">
              {/* artwork */}
              <div className="h-12 w-12 rounded-2xl bg-white/5 border border-white/10 overflow-hidden shrink-0 shadow-lg shadow-black/40">
                {playerMeta?.artwork ? (
                  <img
                    src={playerMeta.artwork}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-[10px] opacity-60">
                    art
                  </div>
                )}
              </div>

              {/* title */}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold truncate">
                  {currentSong?.title ?? "Select a song"}
                </div>
                <div className="text-xs opacity-60 truncate">
                  {currentSong
                    ? playerMeta?.artist ?? parseArtist(currentSong.description)
                    : "—"}
                  {playerMeta?.album ? ` · ${playerMeta.album}` : ""}
                </div>

                {/* seek */}
                <div className="mt-2 flex items-center gap-2">
                  <div className="text-[10px] opacity-60 w-10 text-right">
                    {formatTime(progress)}
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={Math.max(1, duration || 1)}
                    value={Math.min(duration || 1, progress)}
                    onChange={(e) => onSeek(Number(e.target.value))}
                    className="w-full"
                  />
                  <div className="text-[10px] opacity-60 w-10">
                    {formatTime(duration)}
                  </div>
                </div>
              </div>

              {/* controls */}
              <div className="flex items-center gap-2">
                <button
                  className={[
                    "h-10 w-10 rounded-2xl border transition flex items-center justify-center text-sm",
                    shuffle
                      ? "bg-white/15 border-white/20"
                      : "bg-white/5 hover:bg-white/10 border-white/10",
                  ].join(" ")}
                  onClick={() => setShuffle((s) => !s)}
                  title="Shuffle"
                >
                  🔀
                </button>

                <button
                  className="h-10 w-10 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition flex items-center justify-center"
                  onClick={prev}
                  title="Previous"
                >
                  ⏮
                </button>

                <button
                  className={[
                    "h-10 w-14 rounded-2xl border border-white/10 transition flex items-center justify-center font-semibold",
                    isPlaying
                      ? "bg-white/20 shadow-[0_0_16px_rgba(139,92,246,0.55)]"
                      : "bg-white/15 hover:bg-white/20",
                  ].join(" ")}
                  onClick={playPause}
                  title="Play / Pause"
                >
                  {isPlaying ? "⏸" : "▶"}
                </button>

                <button
                  className="h-10 w-10 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition flex items-center justify-center"
                  onClick={next}
                  title="Next"
                >
                  ⏭
                </button>

                <button
                  className={[
                    "h-10 w-10 rounded-2xl border transition flex items-center justify-center text-sm",
                    repeat !== "OFF"
                      ? "bg-white/15 border-white/20"
                      : "bg-white/5 hover:bg-white/10 border-white/10",
                  ].join(" ")}
                  onClick={cycleRepeat}
                  title={`Repeat: ${repeat}`}
                >
                  🔁
                </button>
              </div>
            </div>

            {/* small hint line */}
            <div className="px-4 pb-3 text-[11px] opacity-60">
              Tip: Use Explore for new picks. Lyrics are stored in notes per
              song.
            </div>
          </div>
        </div>
      </div>

      <SearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        mediaTypeFilter={"MUSIC"}
      />
    </div>
  );
}
