import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  changeRewatchCount,
  fetchAccountPreferences,
  fetchItem,
  fetchLibrary,
  fetchTags,
  setManualFranchise,
  setItemTags,
  updateItem,
  type ItemPatch,
} from "../app/api";
import type { MediaStatus, Tag } from "../types";
import { RatingInput } from "../components/RatingInput";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ProgressEditor } from "../components/ProgressEditor";
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
import { EpisodeGuide } from "../components/EpisodeGuide";
import { WhereToWatch } from "../components/WhereToWatch";

const TYPE_LABEL = { MOVIE: "Movie", TV: "TV", ANIME: "Anime", BOOK: "Book" } as const;
const CREATOR_LABEL = { MOVIE: "Directed by", TV: "Created by", ANIME: "Studio", BOOK: "By" } as const;

// Script stylesheets are only fetched when a title in that language is opened.
const loadedScripts = new Set<string>();
function loadScriptFont(language?: string | null) {
  const code = language?.toLowerCase().split("-")[0];
  const loader =
    code === "ja" ? () => import("@fontsource-variable/noto-sans-jp/wght.css")
    : code === "ko" ? () => import("@fontsource-variable/noto-sans-kr/wght.css")
    : code === "zh" ? () => import("@fontsource-variable/noto-sans-sc/wght.css")
    : code === "ur" ? () => import("@fontsource/noto-nastaliq-urdu/400.css")
    : null;
  if (!code || !loader || loadedScripts.has(code)) return;
  loadedScripts.add(code);
  loader().catch(() => loadedScripts.delete(code));
}

export function MediaDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();

  const { data: item } = useQuery({ queryKey: ["item", id], queryFn: () => fetchItem(id!) });
  const { data: preferences, isError: preferencesError } = useQuery({
    queryKey: ["account-preferences"],
    queryFn: fetchAccountPreferences,
  });
  const { data: allTags = [] } = useQuery({ queryKey: ["tags"], queryFn: fetchTags });
  const { data: animeLibrary = [] } = useQuery({
    queryKey: ["library", "ANIME"],
    queryFn: () => fetchLibrary("ANIME"),
    enabled: item?.mediaType === "ANIME",
  });
  const franchiseOptions = [...new Map(
    animeLibrary
      .filter((entry) => entry.franchiseId && entry.franchise?.title)
      .map((entry) => [entry.franchiseId!, { id: entry.franchiseId!, title: entry.franchise!.title }])
  ).values()].sort((a, b) => a.title.localeCompare(b.title));

  const [notes, setNotes] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [posterAccent, setPosterAccent] = useState<string | null>(null);
  const [descriptionRevealed, setDescriptionRevealed] = useState(false);
  const [episodesOpen, setEpisodesOpen] = useState(false);

  // Sync the notes draft from the loaded item so saving without editing keeps
  // the real value instead of overwriting it.
  useEffect(() => {
    if (item) setNotes(item.yourNotes ?? "");
  }, [item?.id, item?.yourNotes]);

  useEffect(() => {
    setDescriptionRevealed(false);
    setEpisodesOpen(false);
  }, [item?.id]);

  useEffect(() => {
    loadScriptFont(item?.originalLanguage);
  }, [item?.originalLanguage]);

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
    qc.invalidateQueries({ queryKey: ["library"] });
    qc.invalidateQueries({ queryKey: ["suggestions"] });
  };

  const mut = useMutation({
    mutationFn: (patch: ItemPatch) => updateItem(id!, patch),
    onSuccess: (updated, patch) => {
      refresh();
      if (updated.status === "COMPLETED" && item?.status !== "COMPLETED" && patch.status === undefined) {
        showToast({ message: `Marked ${statusLabel("COMPLETED", updated.mediaType)}`, timeoutMs: 4000 });
      }
    },
    onError: (err: any) => showToast({ message: err?.response?.data?.error ?? "Couldn't save", timeoutMs: 6000 }),
  });

  const rewatchMut = useMutation({
    mutationFn: (delta: -1 | 1) => changeRewatchCount(id!, delta),
    onSuccess: refresh,
    onError: (err: any) => showToast({ message: err?.response?.data?.error ?? "Couldn't update the rewatch count", timeoutMs: 6000 }),
  });

  const saveTags = async (names: string[], kind: Tag["kind"]) => {
    try {
      await setItemTags(id!, names, kind);
      qc.invalidateQueries({ queryKey: ["item", id] });
      qc.invalidateQueries({ queryKey: ["tags"] });
      qc.invalidateQueries({ queryKey: ["library"] });
    } catch (err: any) {
      showToast({ message: err?.response?.data?.error ?? "Couldn't save tags", timeoutMs: 6000 });
    }
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
  const releaseDate = item.releaseDate ? new Date(item.releaseDate) : null;
  const releaseText = releaseDate && !Number.isNaN(releaseDate.getTime())
    ? releaseDate.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
    : null;
  const shielded = (item.mediaType === "TV" || item.mediaType === "ANIME")
    && preferences?.spoilerShield !== false && item.status !== "COMPLETED" && !descriptionRevealed;
  const rewatches = item.rewatchCount ?? 0;
  const rewatchWord = item.mediaType === "BOOK" ? "Rereads" : "Rewatches";
  const stepButton = "min-h-11 min-w-11 rounded-xl bg-white/10 text-base hover:bg-white/20 disabled:opacity-40";

  return (
    <div className="min-h-screen pb-10">
      <div
        className="detail-hero relative isolate overflow-hidden"
        style={{ "--poster-accent": posterAccent ?? "transparent" } as CSSProperties}
      >
        {item.backdropUrl ? (
          <img src={item.backdropUrl} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-70" />
        ) : (
          <div className="absolute inset-0 -z-10 bg-white/5" />
        )}
        <div className="detail-hero-shade absolute inset-0 -z-10" />
        <div className="mx-auto max-w-4xl px-4 pb-6 pt-4 md:px-8">
          <button className="min-h-11 text-sm text-white/80 hover:text-white" onClick={() => nav(-1)}>
            ← Back
          </button>
          <div className="mt-16 flex gap-4">
            <div className="h-36 w-24 shrink-0 overflow-hidden rounded-xl bg-white/5 md:h-48 md:w-32">
              {item.posterUrl ? <img src={item.posterUrl} alt="" className="h-full w-full object-cover" /> : null}
            </div>
            <div className="min-w-0 self-end">
              {item.franchise && item.franchiseRole && item.franchiseRole !== "MAIN" ? (
                <button className="text-xs text-white/85 underline underline-offset-2" onClick={() => nav(`/franchise/${item.franchiseId}`)}>
                  {item.franchise.title} ›
                </button>
              ) : null}
              <h1 className="text-xl font-semibold md:text-3xl">{item.title}</h1>
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
              {releaseText ? <div className="text-sm text-white/80">Released {releaseText}</div> : null}
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

          <section className="mt-5 space-y-4 rounded-[var(--radius-panel)] bg-black/40 p-4 backdrop-blur" aria-label="Track">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Status">
              {STATUSES.map((s: MediaStatus) => (
                <button
                  key={s}
                  className={`min-h-11 rounded-full px-4 text-sm transition ${
                    item.status === s ? "bg-white/25 font-semibold" : "bg-white/10 hover:bg-white/15"
                  }`}
                  aria-pressed={item.status === s}
                  disabled={mut.isPending}
                  onClick={() => mut.mutate({ status: s })}
                >
                  {statusLabel(s, item.mediaType)}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
              <div>
                <div className="text-xs text-white/75">Your rating</div>
                <div className="mt-1">
                  <RatingInput value={mine} onChange={(v) => mut.mutate({ yourRating: v })} />
                </div>
                {item.yourRatingAt && mine != null ? (
                  <p className="mt-1 text-xs text-white/70">Rated {new Date(item.yourRatingAt).toLocaleDateString()}</p>
                ) : null}
              </div>
              {item.mediaType !== "MOVIE" ? (
                <div>
                  <div className="mb-2 text-xs text-white/75">Progress</div>
                  <ProgressEditor item={item} onPatch={(p) => mut.mutate(p)} />
                </div>
              ) : null}
              {item.status === "COMPLETED" ? (
                <div>
                  <div className="text-xs text-white/75">{rewatchWord}</div>
                  <div className="mt-1 flex items-center gap-2" role="group" aria-label={rewatchWord}>
                    <button
                      type="button"
                      className={stepButton}
                      aria-label={`Decrease ${rewatchWord.toLowerCase()}`}
                      disabled={rewatches <= 0 || rewatchMut.isPending}
                      onClick={() => rewatchMut.mutate(-1)}
                    >
                      −
                    </button>
                    <span className="min-w-8 text-center font-semibold tabular-nums" aria-live="polite">{rewatches}</span>
                    <button
                      type="button"
                      className={stepButton}
                      aria-label={`Increase ${rewatchWord.toLowerCase()}`}
                      disabled={rewatchMut.isPending}
                      onClick={() => rewatchMut.mutate(1)}
                    >
                      +
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>

      <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 md:px-8">
        {genres.length ? (
          <ul className="flex flex-wrap gap-2" aria-label="Genres">
            {genres.slice(0, 8).map((g) => (
              <li key={g} className="rounded-full bg-white/10 px-2.5 py-1 text-xs">{g}</li>
            ))}
          </ul>
        ) : null}

        <section aria-labelledby="synopsis-heading">
          <h2 id="synopsis-heading" className="text-sm font-semibold">Synopsis</h2>
          {item.description ? (
            <>
              <p className={`mt-2 whitespace-pre-line text-sm leading-relaxed text-[var(--tx2)] ${shielded ? "select-none blur-sm" : ""}`}>
                {plainText(item.description)}
              </p>
              {shielded ? (
                <button type="button" className="mt-2 min-h-11 text-xs font-semibold text-[var(--acc)] underline underline-offset-2" onClick={() => setDescriptionRevealed(true)}>
                  Reveal description
                </button>
              ) : null}
            </>
          ) : (
            <p className="mt-2 text-sm text-[var(--tx3)]">No description is available.</p>
          )}
        </section>

        {preferences ? <WhereToWatch item={item} country={preferences.watchCountry} /> : null}

        {item.mediaType === "TV" || item.mediaType === "ANIME" ? (
          <details
            className="surface-card rounded-[var(--radius-panel)] p-4"
            open={episodesOpen}
            onToggle={(e) => setEpisodesOpen(e.currentTarget.open)}
          >
            <summary className="min-h-11 cursor-pointer text-sm font-semibold">Episode guide</summary>
            {episodesOpen ? (
              <div className="mt-3">
                <EpisodeGuide item={item} shieldSpoilers={preferences?.spoilerShield ?? true} />
              </div>
            ) : null}
          </details>
        ) : null}

        {item.franchiseId || item.collectionId || item.mediaType === "ANIME" ? (
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
            {item.mediaType === "ANIME" ? (
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex min-h-11 items-center gap-2 text-sm text-[var(--tx2)]">
                    Move to franchise
                    <select
                      aria-label="Move anime to franchise"
                      value={item.franchiseId ?? ""}
                      className="min-h-11 max-w-[min(16rem,65vw)] rounded-xl border border-[var(--line2)] bg-[var(--s1)] px-3 text-[var(--tx)]"
                      onChange={async (event) => {
                        try {
                          await setManualFranchise(item.id, event.target.value || null);
                          await Promise.all([
                            qc.invalidateQueries({ queryKey: ["item", id] }),
                            qc.invalidateQueries({ queryKey: ["library"] }),
                            qc.invalidateQueries({ queryKey: ["franchise"] }),
                          ]);
                          showToast({ message: "Franchise grouping updated", timeoutMs: 4000 });
                        } catch (error: any) {
                          showToast({ message: error?.response?.data?.error ?? "Couldn’t update franchise grouping", timeoutMs: 6000 });
                        }
                      }}
                    >
                      <option value="">No franchise</option>
                      {franchiseOptions.map((option) => <option key={option.id} value={option.id}>{option.title}</option>)}
                    </select>
                  </label>
                  {item.franchiseOverride ? <span className="text-xs text-[var(--tx3)]">Manual grouping; provider refresh won’t replace it.</span> : null}
                </div>
              ) : null}
          </div>
        ) : null}

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

        <details className="surface-card rounded-[var(--radius-panel)] p-4">
          <summary className="min-h-11 cursor-pointer text-sm font-semibold">Organise</summary>
          <div className="mt-3 space-y-5">
            <section className="space-y-3" aria-labelledby="lists-heading">
              <h2 id="lists-heading" className="text-sm font-semibold">Lists &amp; tags</h2>
              <ListsPanel item={item} />
              <TagEditor tags={tags} allTags={allTags} onChange={saveTags} />
            </section>

            <section aria-labelledby="notes-heading">
              <h2 id="notes-heading" className="text-sm font-semibold">Private notes</h2>
              <p className="mt-1 text-xs text-white/75">Only for you.</p>
              <textarea
                aria-labelledby="notes-heading"
                className="mt-2 min-h-[90px] w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <button
                className="mt-2 min-h-11 rounded-xl bg-white/10 px-4 text-sm transition hover:bg-white/15 disabled:opacity-50"
                disabled={mut.isPending || notes === (item.yourNotes ?? "")}
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
                    className="min-h-11 rounded-xl border border-white/15 bg-black/30 px-3"
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

            <div className="border-t border-white/10 pt-3">
              <button
                type="button"
                className="min-h-11 rounded-xl px-4 text-sm text-rose-300 hover:bg-rose-500/10"
                onClick={() => setConfirmDelete(true)}
              >
                Remove from library
              </button>
            </div>
          </div>
        </details>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title={`Remove "${item.title}"?`}
        body="Its status, rating, progress and notes are removed too. You can undo for 10 seconds."
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
