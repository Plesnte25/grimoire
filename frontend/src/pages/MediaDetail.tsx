import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createLog,
  deleteLog,
  fetchAccountPreferences,
  fetchItem,
  fetchItemLogs,
  fetchTags,
  setItemTags,
  updateItem,
  updateLog,
  type ItemPatch,
  type LogInput,
} from "../app/api";
import type { MediaStatus, Tag, WatchLog } from "../types";
import { RatingInput } from "../components/RatingInput";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ProgressEditor } from "../components/ProgressEditor";
import { LogDialog } from "../components/LogDialog";
import { HistorySection } from "../components/HistorySection";
import { TagEditor } from "../components/TagEditor";
import { ListsPanel } from "../components/ListsPanel";
import { safeParseGenres } from "../components/MediaCard";
import { formatScore, onlineRating, onlineRatingText, personalRating, scoreGroups } from "../lib/ratings";
import { STATUSES, statusLabel } from "../lib/status";
import { deleteWithUndo } from "../lib/deleteWithUndo";
import { showToast } from "../lib/toast";
import { plainText } from "../lib/text";
import { REGIONS, REGION_LABEL, countryName } from "../lib/regions";
import { ManualDetailsEditor } from "../components/ManualDetailsEditor";
import { CountryFlag } from "../components/CountryFlag";

const TYPE_LABEL = { MOVIE: "Movie", TV: "TV", ANIME: "Anime", BOOK: "Book" } as const;
const CREATOR_LABEL = { MOVIE: "Directed by", TV: "Created by", ANIME: "Studio", BOOK: "By" } as const;

type LogEditor = { log: WatchLog | null; title: string } | null;

export function MediaDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();

  const { data: item } = useQuery({ queryKey: ["item", id], queryFn: () => fetchItem(id!) });
  const { data: preferences, isError: preferencesError } = useQuery({
    queryKey: ["account-preferences"],
    queryFn: fetchAccountPreferences,
  });
  const { data: logs = [] } = useQuery({ queryKey: ["logs", id], queryFn: () => fetchItemLogs(id!), enabled: !!id });
  const { data: allTags = [] } = useQuery({ queryKey: ["tags"], queryFn: fetchTags });

  const [notes, setNotes] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [logEditor, setLogEditor] = useState<LogEditor>(null);
  const [posterAccent, setPosterAccent] = useState<string | null>(null);

  // Sync the notes draft from the loaded item so saving without editing keeps
  // the real value instead of overwriting it.
  useEffect(() => {
    if (item) setNotes(item.yourNotes ?? "");
  }, [item?.id, item?.yourNotes]);

  useEffect(() => {
    setPosterAccent(null);
    if (!item?.posterUrl) return;
    let active = true;
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      if (!active) return;
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 24;
        canvas.height = 24;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) return;
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let red = 0;
        let green = 0;
        let blue = 0;
        let count = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          if (pixels[i + 3] < 180) continue;
          red += pixels[i];
          green += pixels[i + 1];
          blue += pixels[i + 2];
          count++;
        }
        if (!count) return;
        red /= count;
        green /= count;
        blue /= count;
        const luminance = (red * 0.2126 + green * 0.7152 + blue * 0.0722) / 255;
        const scale = luminance > 0.28 ? 0.28 / luminance : 1;
        setPosterAccent(`rgb(${Math.round(red * scale)} ${Math.round(green * scale)} ${Math.round(blue * scale)})`);
      } catch {
        // Cross-origin images without CORS permission keep the untinted fallback.
      }
    };
    image.src = item.posterUrl;
    return () => {
      active = false;
      image.onload = null;
    };
  }, [item?.posterUrl]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["item", id] });
    qc.invalidateQueries({ queryKey: ["logs", id] });
    qc.invalidateQueries({ queryKey: ["library"] });
    qc.invalidateQueries({ queryKey: ["suggestions"] });
  };

  const mut = useMutation({
    mutationFn: (patch: ItemPatch) => updateItem(id!, patch),
    onSuccess: async (updated, patch) => {
      refresh();
      // Completing something (directly, or by reaching the last episode) records a
      // history entry; offer to add the date, rating and review right away.
      if (updated.status === "COMPLETED" && item?.status !== "COMPLETED") {
        const fresh = await qc.fetchQuery({ queryKey: ["logs", id], queryFn: () => fetchItemLogs(id!) });
        setLogEditor({ log: fresh.find((l) => l.finishedAt) ?? null, title: "Finished. Anything to add?" });
        if (patch.status === undefined) showToast({ message: `Marked ${statusLabel("COMPLETED", updated.mediaType)}`, timeoutMs: 4000 });
      }
    },
    onError: (err: any) => showToast({ message: err?.response?.data?.error ?? "Couldn't save", timeoutMs: 6000 }),
  });

  const saveLog = async (input: LogInput) => {
    try {
      if (logEditor?.log) await updateLog(logEditor.log.id, input);
      else await createLog(id!, input);
      setLogEditor(null);
      refresh();
    } catch (err: any) {
      showToast({ message: err?.response?.data?.error ?? "Couldn't save this entry", timeoutMs: 6000 });
    }
  };

  const removeLog = async () => {
    if (!logEditor?.log) return;
    await deleteLog(logEditor.log.id);
    setLogEditor(null);
    refresh();
  };

  const saveTags = async (names: string[], kind: Tag["kind"]) => {
    await setItemTags(id!, names, kind);
    qc.invalidateQueries({ queryKey: ["item", id] });
    qc.invalidateQueries({ queryKey: ["tags"] });
    qc.invalidateQueries({ queryKey: ["library"] });
  };

  if (!item) return <div className="min-h-screen p-6">Loading…</div>;
  if (item.isAdult && !preferences && preferencesError) {
    return <div role="alert" className="mx-auto max-w-xl px-5 py-16 text-center text-sm text-[var(--err)]">Couldn't load account content preferences. Refresh and try again.</div>;
  }
  if (item.isAdult && !preferences) return <div className="min-h-screen p-6">Loading…</div>;
  if (item.isAdult && !preferences?.showAdultContent) {
    return (
      <div className="mx-auto max-w-xl px-5 py-16 text-center">
        <h1 className="font-display text-3xl">18+ title hidden</h1>
        <p className="mt-3 text-sm text-[var(--tx2)]">Enable adult titles in account settings to view this page.</p>
        <button
          type="button"
          className="mt-5 min-h-11 rounded-xl bg-[var(--accbg)] px-4 text-sm font-semibold text-[var(--acc-ink)]"
          onClick={() => nav("/settings")}
        >
          Open settings
        </button>
      </div>
    );
  }

  const mine = personalRating(item);
  const online = onlineRating(item);
  const scores = scoreGroups(item);
  const genres = safeParseGenres(item.genres);
  const tags = (item.tags ?? []).map((t) => t.tag);
  const credits = item.credits ?? [];
  const creators = credits.filter((c) => c.role !== "CAST");
  const cast = credits.filter((c) => c.role === "CAST");
  const facts = [
    TYPE_LABEL[item.mediaType],
    item.year ? String(item.year) : null,
    item.seasons ? `${item.seasons} season${item.seasons === 1 ? "" : "s"}` : null,
    item.mediaType !== "MOVIE" && item.episodes ? `${item.episodes} episodes` : null,
    item.mediaType === "BOOK" && item.pageCount ? `${item.pageCount} pages` : null,
    item.duration ? `${item.duration} min${item.mediaType === "MOVIE" ? "" : " / ep"}` : null,
  ].filter(Boolean);

  return (
    <div className="min-h-screen px-4 md:px-8 py-6 max-w-4xl mx-auto">
      <button className="min-h-11 text-sm text-white/80 hover:text-white" onClick={() => nav(-1)}>
        ← Back
      </button>

      <div className="surface-card mt-2 overflow-hidden rounded-[var(--radius-panel)]">
        <div
          className="detail-hero relative"
          style={{ "--poster-accent": posterAccent ?? "transparent" } as CSSProperties}
        >
          {item.backdropUrl ? (
            <img src={item.backdropUrl} alt="" className="relative z-0 h-52 w-full object-cover opacity-80" />
          ) : (
            <div className="relative z-0 h-52 w-full bg-white/5" />
          )}
          <div className="detail-hero-shade absolute inset-0 z-0" />
          <div className="absolute bottom-0 left-0 z-10 flex gap-4 p-4">
            <div className="w-20 h-28 shrink-0 rounded-xl overflow-hidden bg-white/5">
              {item.posterUrl ? <img src={item.posterUrl} alt="" className="w-full h-full object-cover" /> : null}
            </div>
            <div className="min-w-0">
              {item.franchise && item.franchiseRole && item.franchiseRole !== "MAIN" ? (
                <button className="text-xs text-white/85 underline underline-offset-2" onClick={() => nav(`/franchise/${item.franchiseId}`)}>
                  {item.franchise.title} ›
                </button>
              ) : null}
              <h1 className="text-xl md:text-2xl font-semibold">{item.title}</h1>
              {item.nativeTitle && item.nativeTitle !== item.title ? (
                <div className="text-sm text-white/80" lang={item.originalLanguage ?? undefined} dir={item.originalLanguage === "ur" ? "rtl" : undefined}>
                  {item.nativeTitle}
                </div>
              ) : null}
              <div className="mt-1 flex flex-wrap items-center gap-x-1 text-sm text-white/80">
                {item.countryOfOrigin ? (
                  <span className="inline-flex items-center gap-1">
                    <CountryFlag code={item.countryOfOrigin} />
                    {countryName(item.countryOfOrigin)}
                  </span>
                ) : null}
                {item.countryOfOrigin && facts.length ? <span aria-hidden="true">·</span> : null}
                <span>{facts.join(" · ")}</span>
              </div>
              <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                <div className="flex gap-1.5">
                  <dt className="text-white/75">You</dt>
                  <dd className="font-semibold">{mine != null ? formatScore(mine) : "Not rated"}</dd>
                </div>
                <div className="flex gap-1.5">
                  <dt className="text-white/75">Audience</dt>
                  <dd className="font-semibold">
                    {scores.audience.length
                      ? scores.audience.map((c) => `${c.source} ${c.text}`).join("  ·  ")
                      : online
                        ? onlineRatingText(online)
                        : "No rating"}
                  </dd>
                </div>
                {scores.critics.length ? (
                  <div className="flex gap-1.5">
                    <dt className="text-white/75">Critics</dt>
                    <dd className="font-semibold">{scores.critics.map((c) => `${c.source} ${c.text}`).join("  ·  ")}</dd>
                  </div>
                ) : null}
              </dl>
            </div>
          </div>
        </div>

        <div className="p-4 md:p-6 space-y-6">
          {creators.length ? (
            <p className="text-sm">
              <span className="text-white/75">{CREATOR_LABEL[item.mediaType]} </span>
              {creators.map((c, i) => (
                <span key={c.contributor.id}>
                  {i > 0 ? ", " : ""}
                  <button className="underline underline-offset-2 hover:text-white" onClick={() => nav(`/people/${encodeURIComponent(c.contributor.id)}`)}>
                    {c.contributor.name}
                  </button>
                </span>
              ))}
            </p>
          ) : item.creator ? (
            <p className="text-sm">
              <span className="text-white/75">{CREATOR_LABEL[item.mediaType]} </span>
              {item.creator}
            </p>
          ) : null}

          {item.franchiseId || item.collectionId ? (
            <div className="flex flex-wrap gap-2">
              {item.franchiseId ? (
                <button className="min-h-11 rounded-xl bg-white/10 px-4 text-sm hover:bg-white/15" onClick={() => nav(`/franchise/${item.franchiseId}`)}>
                  See the whole {item.franchise?.title ?? "franchise"} →
                </button>
              ) : null}
              {item.collectionId && item.collectionSource === "tmdb" ? (
                <button className="min-h-11 rounded-xl bg-white/10 px-4 text-sm hover:bg-white/15" onClick={() => nav(`/collection/${item.collectionId}`)}>
                  Part of {item.collectionName ?? "a collection"} →
                </button>
              ) : null}
            </div>
          ) : null}

          {cast.length ? (
            <section aria-labelledby="cast-heading">
              <h2 id="cast-heading" className="text-sm font-semibold">Cast</h2>
              <ul className="mt-2 flex gap-3 overflow-x-auto pb-2">
                {cast.map((c) => (
                  <li key={c.contributor.id} className="w-24 shrink-0">
                    <button className="w-full text-left" onClick={() => nav(`/people/${encodeURIComponent(c.contributor.id)}`)}>
                      <div className="h-24 w-24 overflow-hidden rounded-full bg-white/10">
                        {c.contributor.imageUrl ? <img src={c.contributor.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
                      </div>
                      <div className="mt-1 line-clamp-2 text-xs font-semibold">{c.contributor.name}</div>
                      {c.character ? <div className="line-clamp-1 text-xs text-white/75">{c.character}</div> : null}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {genres.length ? (
            <ul className="flex flex-wrap gap-2" aria-label="Genres">
              {genres.slice(0, 8).map((g) => (
                <li key={g} className="text-xs px-2.5 py-1 rounded-full bg-white/10">{g}</li>
              ))}
            </ul>
          ) : null}

          {item.description ? (
            <div>
              <h2 className="text-sm font-semibold">Description</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-[var(--tx2)]">{plainText(item.description)}</p>
            </div>
          ) : null}

          <div className="grid md:grid-cols-2 gap-4">
            <section className="surface-card space-y-5 rounded-[var(--radius-panel)] p-4" aria-labelledby="track-heading">
              <h2 id="track-heading" className="text-sm font-semibold">Track</h2>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Status">
                {STATUSES.map((s: MediaStatus) => (
                  <button
                    key={s}
                    className={`min-h-11 text-sm px-4 rounded-full transition ${
                      item.status === s ? "bg-white/25 font-semibold" : "bg-white/10 hover:bg-white/15"
                    }`}
                    aria-pressed={item.status === s}
                    onClick={() => mut.mutate({ status: s })}
                  >
                    {statusLabel(s, item.mediaType)}
                  </button>
                ))}
              </div>

              <div>
                <div className="text-xs text-white/75">Your rating</div>
                <div className="mt-1">
                  <RatingInput value={mine} onChange={(v) => mut.mutate({ yourRating: v })} />
                </div>
                {item.yourRatingAt && mine != null ? (
                  <p className="mt-1 text-xs text-[var(--tx3)]">
                    Rated {new Date(item.yourRatingAt).toLocaleDateString()}
                  </p>
                ) : null}
              </div>

              <div>
                <div className="text-xs text-white/75 mb-2">Progress</div>
                <ProgressEditor item={item} onPatch={(p) => mut.mutate(p)} />
              </div>
            </section>

            <section className="surface-card space-y-5 rounded-[var(--radius-panel)] p-4" aria-labelledby="lists-heading">
              <h2 id="lists-heading" className="text-sm font-semibold">Lists</h2>
              <ListsPanel item={item} />
              <TagEditor tags={tags} allTags={allTags} onChange={saveTags} />
            </section>
          </div>

          <HistorySection
            logs={logs}
            mediaType={item.mediaType}
            onAdd={() => setLogEditor({ log: null, title: item.mediaType === "BOOK" ? "Log a read" : "Log a watch" })}
            onEdit={(log) => setLogEditor({ log, title: "Edit entry" })}
          />

          <section aria-labelledby="notes-heading">
            <h2 id="notes-heading" className="text-sm font-semibold">Private notes</h2>
            <p className="text-xs text-white/75 mt-1">Only for you. Reviews go in History.</p>
            <textarea
              aria-labelledby="notes-heading"
              className="mt-2 w-full min-h-[90px] rounded-xl bg-black/30 border border-white/15 px-3 py-2 text-sm"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <button
              className="mt-2 min-h-11 rounded-xl px-4 bg-white/10 hover:bg-white/15 transition text-sm"
              onClick={() => mut.mutate({ yourNotes: notes })}
            >
              Save notes
            </button>
          </section>

          {item.mediaType === "TV" || item.mediaType === "MOVIE" ? (
            <section aria-labelledby="category-heading" className="space-y-2">
              <h2 id="category-heading" className="text-sm font-semibold">Category</h2>
              <label className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-white/80">Show this under</span>
                <select
                  className="min-h-11 rounded-xl bg-black/30 border border-white/15 px-3"
                  value={item.regionOverride ?? "AUTO"}
                  onChange={(e) =>
                    mut.mutate({ regionOverride: e.target.value === "AUTO" ? null : (e.target.value as any) })
                  }
                >
                  <option value="AUTO">
                    Automatic ({item.region ? REGION_LABEL[item.region] : item.mediaType === "TV" ? "TV" : "Movies"})
                  </option>
                  <option value="NONE">{item.mediaType === "TV" ? "TV" : "Movies"} only</option>
                  {REGIONS.map((r) => (
                    <option key={r} value={r}>{REGION_LABEL[r]}</option>
                  ))}
                </select>
              </label>
              <p className="text-xs text-white/70">For co-productions and dubs that land in the wrong place.</p>
            </section>
          ) : null}

          {item.provider === "manual" ? <ManualDetailsEditor item={item} onPatch={(p) => mut.mutate(p as any)} /> : null}

          <div className="border-t border-white/10 pt-4">
            <button
              type="button"
              className="min-h-11 rounded-xl px-4 text-sm text-rose-300 hover:bg-rose-500/10"
              onClick={() => setConfirmDelete(true)}
            >
              Remove from library
            </button>
          </div>
        </div>
      </div>

      <LogDialog
        open={logEditor != null}
        title={logEditor?.title ?? ""}
        mediaType={item.mediaType}
        log={logEditor?.log}
        previousRating={logs.find((entry) => entry.id !== logEditor?.log?.id && entry.rating != null) ?? null}
        rewatchOrdinal={logs.filter((entry) => entry.finishedAt && entry.id !== logEditor?.log?.id).length + 1}
        onSave={saveLog}
        onDelete={logEditor?.log ? removeLog : undefined}
        onClose={() => setLogEditor(null)}
      />

      <ConfirmDialog
        open={confirmDelete}
        title={`Remove "${item.title}"?`}
        body="Its status, rating, progress, history and notes are removed too. You can undo for 10 seconds."
        confirmLabel="Remove"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          deleteWithUndo(qc, item);
          // Opened from a direct link there's no in-app history to go back to.
          if ((window.history.state?.idx ?? 0) > 0) nav(-1);
          else nav(`/category/${item.mediaType}`);
        }}
      />
    </div>
  );
}
