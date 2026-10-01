import axios from "axios";
import type { MediaItem, Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { tmdbGet, TMDB_IMAGE_BASE } from "./providers/tmdb.js";
import { postAniList } from "./providers/anilist.js";
import { googleBooksGet } from "./providers/googleBooks.js";
import { regionForItem } from "../lib/regions.js";

// Provider metadata is fetched once per item (on add, or by the backfill
// script) and stored. Library reads never call providers. metaCheckedAt is set
// even when a provider has nothing, so an item is never re-fetched in a loop.

type CreditInput = {
    contributorId: string;
    name: string;
    kind: "PERSON" | "STUDIO";
    imageUrl?: string | null;
    role: "DIRECTOR" | "CREATOR" | "AUTHOR" | "CAST" | "STUDIO";
    character?: string | null;
    order: number;
};

type FranchiseInput = {
    id: string;
    title: string;
    nativeTitle?: string | null;
    posterUrl?: string | null;
    bannerUrl?: string | null;
    countryOfOrigin?: string | null;
    status?: string | null;
};

export type Enrichment = {
    data: Prisma.MediaItemUncheckedUpdateInput;
    credits: CreditInput[];
    franchise?: FranchiseInput;
};

/* ------------------------------ helpers ------------------------------ */

function dateOrNull(s?: string | null): Date | null {
    if (!s) return null;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
}

function isEmpty(v: unknown) {
    return v == null || (typeof v === "string" && v.trim() === "");
}

/** Provider values only fill fields the user's item doesn't have yet. */
function fill<T>(current: unknown, next: T | null | undefined): T | undefined {
    return isEmpty(current) && next != null ? next : undefined;
}

function genresJson(names: unknown): string | null {
    if (!Array.isArray(names)) return null;
    const clean = names.map((g) => String(g).trim()).filter(Boolean);
    return clean.length ? JSON.stringify(clean) : null;
}

function tmdbImage(path: string | null | undefined, size: "w185" | "w500" | "w780") {
    return path ? `${TMDB_IMAGE_BASE}/${size}${path}` : null;
}

/** AniList's "plain" descriptions still contain <br>/<i> tags and entities. */
function cleanDescription(s?: string | null): string | null {
    if (!s) return null;
    const text = s
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
        .replace(/[ \t]*\n[ \t]*/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    return text || null;
}

function slug(s: string) {
    return s
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

/* ------------------------------- scores ------------------------------- */

const OMDB_API_KEY = process.env.OMDB_API_KEY;

function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
}

function num(v: unknown): number | null {
    const n = Number(String(v ?? "").replace(/[,%]/g, "").split("/")[0]);
    return Number.isFinite(n) && String(v ?? "").trim() !== "" && v !== "N/A" ? n : null;
}

/**
 * IMDb (audience) + Rotten Tomatoes / Metacritic (critics) from OMDb, by IMDb id.
 * Only runs when OMDB_API_KEY is set (free key, 1,000 requests/day).
 */
async function omdbScores(imdbId: string | null): Promise<Prisma.MediaItemUncheckedUpdateInput> {
    if (!OMDB_API_KEY || !imdbId) return {};
    const res = await axios.get("https://www.omdbapi.com/", { params: { i: imdbId, apikey: OMDB_API_KEY }, timeout: 12_000 });
    const d = res.data;
    if (d?.Response !== "True") return {};
    const rating = (source: string) => (d.Ratings ?? []).find((r: any) => r.Source === source)?.Value;
    return {
        imdbRating: num(d.imdbRating),
        imdbVotes: num(d.imdbVotes),
        rtCritics: num(rating("Rotten Tomatoes")),
        metascore: num(d.Metascore) ?? num(rating("Metacritic")),
        scoresCheckedAt: new Date(),
    };
}

// Jikan (MyAnimeList, no key): 3 requests/s, 60/min. Keep a gap; retry 429s.
let lastJikanAt = 0;
async function jikanScore(malId: number | null): Promise<Prisma.MediaItemUncheckedUpdateInput> {
    if (!malId) return {};
    for (let attempt = 0; attempt < 3; attempt++) {
        const gap = lastJikanAt + 1100 - Date.now();
        if (gap > 0) await sleep(gap);
        lastJikanAt = Date.now();
        try {
            const res = await axios.get(`https://api.jikan.moe/v4/anime/${malId}`, { timeout: 12_000 });
            const d = res.data?.data;
            return {
                malId,
                malScore: typeof d?.score === "number" ? d.score : null,
                malVotes: typeof d?.scored_by === "number" ? d.scored_by : null,
                scoresCheckedAt: new Date(),
            };
        } catch (err: any) {
            const status = err?.response?.status;
            if (status === 404) return { malId };
            // 429 = rate limit; 5xx = Jikan waiting on MyAnimeList. Both pass.
            const retryable = status === 429 || (status >= 500 && status < 600) || err?.code === "ECONNABORTED";
            if (!retryable || attempt === 2) throw err;
            await sleep(3000 * (attempt + 1));
        }
    }
    return {};
}

/** Score lookups are extras: a failure leaves the rest of the enrichment intact. */
async function safeScores(load: () => Promise<Prisma.MediaItemUncheckedUpdateInput>, label: string) {
    try {
        return await load();
    } catch (err: any) {
        console.error(`Score lookup failed (${label}):`, err?.message ?? err);
        return {};
    }
}

/* -------------------------------- TMDB -------------------------------- */

async function enrichTmdbMovie(item: MediaItem): Promise<Enrichment | null> {
    const r = await tmdbGet(`/movie/${item.providerId}`, { append_to_response: "credits,release_dates,external_ids" });
    if (!r) return null;

    const country: string | null = r.origin_country?.[0] ?? r.production_countries?.[0]?.iso_3166_1 ?? null;
    const release = dateOrNull(r.release_date);

    // Digital release (type 4): prefer the US date, else the earliest anywhere.
    const digitalDates: { country: string; date: Date }[] = [];
    for (const c of r.release_dates?.results ?? []) {
        for (const d of c.release_dates ?? []) {
            const date = d.type === 4 ? dateOrNull(d.release_date) : null;
            if (date) digitalDates.push({ country: c.iso_3166_1, date });
        }
    }
    const digital =
        digitalDates.find((d) => d.country === "US")?.date ??
        digitalDates.sort((a, b) => a.date.getTime() - b.date.getTime())[0]?.date ??
        null;

    const directors = (r.credits?.crew ?? []).filter((c: any) => c.job === "Director");
    const cast = (r.credits?.cast ?? []).slice(0, 8);

    return {
        data: {
            year: fill(item.year, release ? release.getUTCFullYear() : null),
            description: fill(item.description, r.overview || null),
            posterUrl: fill(item.posterUrl, tmdbImage(r.poster_path, "w500")),
            backdropUrl: fill(item.backdropUrl, tmdbImage(r.backdrop_path, "w780")),
            genres: fill(item.genres, genresJson((r.genres ?? []).map((g: any) => g.name))),
            nativeTitle: r.original_title && r.original_title !== r.title ? r.original_title : null,
            duration: typeof r.runtime === "number" && r.runtime > 0 ? r.runtime : null,
            releaseDate: release,
            digitalReleaseDate: digital,
            airStatus: release && release > new Date() ? "UPCOMING" : "RELEASED",
            countryOfOrigin: country,
            originalLanguage: r.original_language ?? null,
            creator: directors.map((d: any) => d.name).join(", ") || null,
            globalRating: typeof r.vote_average === "number" ? r.vote_average : undefined,
            globalRatingText:
                typeof r.vote_count === "number" ? `TMDB (${r.vote_count} votes)` : undefined,
            collectionId: r.belongs_to_collection?.id != null ? String(r.belongs_to_collection.id) : null,
            collectionName: r.belongs_to_collection?.name ?? null,
            collectionSource: r.belongs_to_collection?.id != null ? "tmdb" : null,
            imdbId: r.imdb_id ?? r.external_ids?.imdb_id ?? null,
            ...(await safeScores(() => omdbScores(r.imdb_id ?? r.external_ids?.imdb_id ?? null), `omdb ${item.title}`)),
        },
        credits: [
            ...directors.map((d: any, i: number) => ({
                contributorId: `tmdb-person:${d.id}`,
                name: d.name,
                kind: "PERSON" as const,
                imageUrl: tmdbImage(d.profile_path, "w185"),
                role: "DIRECTOR" as const,
                order: i,
            })),
            ...cast.map((c: any, i: number) => ({
                contributorId: `tmdb-person:${c.id}`,
                name: c.name,
                kind: "PERSON" as const,
                imageUrl: tmdbImage(c.profile_path, "w185"),
                role: "CAST" as const,
                character: c.character || null,
                order: i,
            })),
        ],
    };
}

const TMDB_TV_STATUS: Record<string, string> = {
    "Returning Series": "RETURNING",
    Ended: "ENDED",
    Canceled: "CANCELED",
    "In Production": "IN_PRODUCTION",
    Planned: "IN_PRODUCTION",
    Pilot: "IN_PRODUCTION",
};

async function enrichTmdbTv(item: MediaItem): Promise<Enrichment | null> {
    const r = await tmdbGet(`/tv/${item.providerId}`, { append_to_response: "credits,external_ids" });
    if (!r) return null;

    const last = r.last_episode_to_air ?? null;
    const next = r.next_episode_to_air ?? null;
    const seasons: any[] = (r.seasons ?? []).filter((s: any) => s.season_number >= 1);

    // Episodes aired so far: every earlier season in full + the last aired episode.
    let aired: number | null = null;
    if (last) {
        aired =
            seasons
                .filter((s) => s.season_number < last.season_number)
                .reduce((n, s) => n + (s.episode_count ?? 0), 0) + (last.episode_number ?? 0);
    }

    // A season numbered after the last aired one is an announced next season.
    const upcoming = seasons
        .filter((s) => s.season_number > (last?.season_number ?? 0))
        .sort((a, b) => a.season_number - b.season_number)[0];

    const firstAir = dateOrNull(r.first_air_date);
    const creators = r.created_by ?? [];
    const cast = (r.credits?.cast ?? []).slice(0, 8);

    return {
        data: {
            year: fill(item.year, firstAir ? firstAir.getUTCFullYear() : null),
            description: fill(item.description, r.overview || null),
            posterUrl: fill(item.posterUrl, tmdbImage(r.poster_path, "w500")),
            backdropUrl: fill(item.backdropUrl, tmdbImage(r.backdrop_path, "w780")),
            genres: fill(item.genres, genresJson((r.genres ?? []).map((g: any) => g.name))),
            nativeTitle: r.original_name && r.original_name !== r.name ? r.original_name : null,
            seasons: typeof r.number_of_seasons === "number" ? r.number_of_seasons : null,
            episodes: typeof r.number_of_episodes === "number" ? r.number_of_episodes : null,
            duration: r.episode_run_time?.[0] ?? last?.runtime ?? null,
            releaseDate: firstAir,
            countryOfOrigin: r.origin_country?.[0] ?? null,
            originalLanguage: r.original_language ?? null,
            creator: creators.map((c: any) => c.name).join(", ") || null,
            globalRating: typeof r.vote_average === "number" ? r.vote_average : undefined,
            globalRatingText:
                typeof r.vote_count === "number" ? `TMDB (${r.vote_count} votes)` : undefined,
            airStatus: TMDB_TV_STATUS[r.status] ?? null,
            lastAiredSeason: last?.season_number ?? null,
            lastAiredEpisode: last?.episode_number ?? null,
            lastAiredDate: dateOrNull(last?.air_date),
            nextAirSeason: next?.season_number ?? null,
            nextAirEpisode: next?.episode_number ?? null,
            nextAirDate: dateOrNull(next?.air_date),
            airedEpisodeCount: aired,
            announcedNext: upcoming ? `Season ${upcoming.season_number}` : null,
            announcedNextDate: upcoming ? dateOrNull(upcoming.air_date) : null,
            airCheckedAt: new Date(),
            imdbId: r.external_ids?.imdb_id ?? null,
            ...(await safeScores(() => omdbScores(r.external_ids?.imdb_id ?? null), `omdb ${item.title}`)),
        },
        credits: [
            ...creators.map((c: any, i: number) => ({
                contributorId: `tmdb-person:${c.id}`,
                name: c.name,
                kind: "PERSON" as const,
                imageUrl: tmdbImage(c.profile_path, "w185"),
                role: "CREATOR" as const,
                order: i,
            })),
            ...cast.map((c: any, i: number) => ({
                contributorId: `tmdb-person:${c.id}`,
                name: c.name,
                kind: "PERSON" as const,
                imageUrl: tmdbImage(c.profile_path, "w185"),
                role: "CAST" as const,
                character: c.character || null,
                order: i,
            })),
        ],
    };
}

/* ------------------------------- AniList ------------------------------- */

const ANIME_NODE = `id type format status countryOfOrigin
  startDate { year month day }
  title { romaji english native }
  coverImage { extraLarge large }
  bannerImage`;

const ANIME_QUERY = `
  query ($id: Int) {
    Media(id: $id, type: ANIME) {
      ${ANIME_NODE}
      idMal episodes duration isAdult genres averageScore
      description(asHtml: false)
      nextAiringEpisode { episode airingAt }
      studios(isMain: true) { nodes { id name } }
      relations { edges { relationType(version: 2) node { ${ANIME_NODE} } } }
    }
  }
`;

type AniDate = { year?: number | null; month?: number | null; day?: number | null } | null;

export async function fetchAnime(id: number): Promise<any | null> {
    const data = await postAniList<any>(
        { query: ANIME_QUERY, variables: { id } },
        `enrich:${id}`,
        24 * 60 * 60 * 1000
    );
    return data?.data?.Media ?? null;
}

export function aniTitle(t: any): string {
    return t?.english ?? t?.romaji ?? t?.native ?? "";
}

export function aniDate(d: AniDate): Date | null {
    if (!d?.year) return null;
    return new Date(Date.UTC(d.year, (d.month ?? 1) - 1, d.day ?? 1));
}

/** Sort key in airing order; unknown dates go last. */
export function aniOrder(d: AniDate): number {
    if (!d?.year) return 99_999_999;
    return d.year * 10_000 + (d.month ?? 12) * 100 + (d.day ?? 28);
}

const ANIME_LANGUAGE: Record<string, string> = { JP: "ja", CN: "zh", TW: "zh", KR: "ko" };

const ANILIST_STATUS: Record<string, string> = {
    RELEASING: "AIRING",
    FINISHED: "ENDED",
    NOT_YET_RELEASED: "UPCOMING",
    CANCELLED: "CANCELED",
    HIATUS: "HIATUS",
};

export const TV_FORMATS = new Set(["TV", "TV_SHORT"]);

export function animeEdges(m: any, relation: string): any[] {
    return (m?.relations?.edges ?? []).filter(
        (e: any) => e?.relationType === relation && e?.node?.type === "ANIME"
    );
}

function earliest(edges: any[]): any | null {
    return [...edges].sort((a, b) => aniOrder(a.node.startDate) - aniOrder(b.node.startDate))[0] ?? null;
}

/**
 * An entry is on the main line when it's a TV series (or an ONA for
 * ONA-led franchises: Chinese/Korean donghua) and isn't flagged as a side
 * story of something else (no PARENT relation).
 */
function isMainLine(m: any): boolean {
    if (animeEdges(m, "PARENT").length) return false;
    return TV_FORMATS.has(m.format) || m.format === "ONA";
}

/**
 * Finds the original series ("ONE PIECE") for any anime entry:
 *  1. Side entries (movies, OVAs, specials) step to the main line via PARENT,
 *     then PREQUEL/SEQUEL, then SIDE_STORY (up to 3 hops through other side
 *     entries, e.g. a movie whose prequel is another movie).
 *  2. Walk PREQUEL edges back along the main line to its first entry.
 * ALTERNATIVE and SPIN_OFF are never followed (FMA vs Brotherhood stay apart).
 * Returns null for standalone entries (a film with no series).
 */
async function resolveFranchiseRoot(m: any): Promise<any | null> {
    let main: any | null = isMainLine(m) ? m : null;

    let cursor = m;
    const seen = new Set<number>([m.id]);
    for (let hop = 0; !main && hop < 3; hop++) {
        let nextEdge: any = null;
        for (const rel of ["PARENT", "PREQUEL", "SEQUEL", "SIDE_STORY"]) {
            const edges = animeEdges(cursor, rel).filter((e) => !seen.has(e.node.id));
            const mainLine = edges.filter((e) => TV_FORMATS.has(e.node.format) || e.node.format === "ONA");
            nextEdge = earliest(mainLine) ?? (rel === "PARENT" || rel === "PREQUEL" ? earliest(edges) : null);
            if (nextEdge) break;
        }
        if (!nextEdge) break;
        seen.add(nextEdge.node.id);
        cursor = await fetchAnime(nextEdge.node.id);
        if (!cursor) break;
        if (isMainLine(cursor)) main = cursor;
    }
    if (!main) return null;

    // ONA-led franchises may chain through ONAs; TV-led ones only through TV,
    // so a side-canon ONA tagged PREQUEL doesn't become the root.
    const onaLed = main.format === "ONA";
    const isMainFormat = (fmt: string) => TV_FORMATS.has(fmt) || (onaLed && fmt === "ONA");
    let root = main;
    const visited = new Set<number>([main.id]);
    for (let hop = 0; hop < 40; hop++) {
        const prev = earliest(
            animeEdges(root, "PREQUEL").filter((e) => !visited.has(e.node.id) && isMainFormat(e.node.format))
        );
        const next = prev
            ? await fetchAnime(prev.node.id)
            : await bridgeThroughSideEntries(root, visited, isMainFormat);
        if (prev) visited.add(prev.node.id);
        if (!next) break;
        visited.add(next.id);
        root = next;
    }
    return root;
}

/**
 * Some seasons list an OVA/movie/special as their prequel instead of the
 * previous season (Slime S2 → "Coleus no Yume" OVA → Slime S1). Step through
 * up to two such side entries looking for a main-line series behind them.
 */
async function bridgeThroughSideEntries(
    from: any,
    visited: Set<number>,
    isMainFormat: (fmt: string) => boolean
): Promise<any | null> {
    let frontier = [from];
    for (let depth = 0; depth < 2; depth++) {
        const nextFrontier: any[] = [];
        for (const node of frontier) {
            const sideEdges = animeEdges(node, "PREQUEL").filter(
                (e) => !visited.has(e.node.id) && !isMainFormat(e.node.format)
            );
            for (const edge of [...sideEdges].sort((a, b) => aniOrder(a.node.startDate) - aniOrder(b.node.startDate))) {
                visited.add(edge.node.id);
                const side = await fetchAnime(edge.node.id);
                if (!side) continue;
                const target = earliest(
                    [...animeEdges(side, "PREQUEL"), ...animeEdges(side, "PARENT")].filter(
                        (e) => !visited.has(e.node.id) && isMainFormat(e.node.format)
                    )
                );
                if (target) return fetchAnime(target.node.id);
                nextFrontier.push(side);
            }
        }
        frontier = nextFrontier;
    }
    return null;
}

function franchiseRole(m: any): string {
    if (isMainLine(m)) return "MAIN";
    if (m.format === "MOVIE") return "MOVIE";
    if (m.format === "OVA") return "OVA";
    if (m.format === "ONA") return "ONA";
    return "SPECIAL";
}

async function enrichAnilist(item: MediaItem): Promise<Enrichment | null> {
    const id = Number(item.providerId);
    if (!Number.isFinite(id)) return null;
    const m = await fetchAnime(id);
    if (!m) return null;

    const root = await resolveFranchiseRoot(m);
    const next = m.nextAiringEpisode ?? null;
    const sequel = earliest(animeEdges(m, "SEQUEL").filter((e) => e.node.status === "NOT_YET_RELEASED"));
    const studios = m.studios?.nodes ?? [];

    let aired: number | null = null;
    if (next?.episode) aired = next.episode - 1;
    else if (m.status === "FINISHED" && typeof m.episodes === "number") aired = m.episodes;

    return {
        data: {
            year: fill(item.year, m.startDate?.year ?? null),
            // Replaces the stored text when it still carries AniList's markup.
            description: /<[a-z][^>]*>/i.test(item.description ?? "")
                ? cleanDescription(item.description)
                : fill(item.description, cleanDescription(m.description)),
            posterUrl: fill(item.posterUrl, m.coverImage?.extraLarge ?? m.coverImage?.large ?? null),
            backdropUrl: fill(item.backdropUrl, m.bannerImage ?? null),
            genres: fill(item.genres, genresJson(m.genres)),
            nativeTitle: m.title?.native ?? null,
            format: m.format ?? null,
            isAdult: !!m.isAdult,
            episodes: typeof m.episodes === "number" ? m.episodes : null,
            duration: typeof m.duration === "number" ? m.duration : null,
            releaseDate: aniDate(m.startDate),
            countryOfOrigin: m.countryOfOrigin ?? null,
            originalLanguage: ANIME_LANGUAGE[m.countryOfOrigin] ?? null,
            creator: studios.map((s: any) => s.name).join(", ") || null,
            globalRating: typeof m.averageScore === "number" ? m.averageScore / 10 : undefined,
            globalRatingText:
                typeof m.averageScore === "number" ? `AniList (${m.averageScore})` : undefined,
            // Anime grouping moved from collectionId to franchiseId.
            collectionId: null,
            collectionName: null,
            collectionSource: null,
            franchiseId: root ? String(root.id) : null,
            franchiseRole: root ? franchiseRole(m) : null,
            franchiseOrder: root ? aniOrder(m.startDate) : null,
            airStatus: ANILIST_STATUS[m.status] ?? null,
            nextAirEpisode: next?.episode ?? null,
            nextAirDate: next?.airingAt ? new Date(next.airingAt * 1000) : null,
            airedEpisodeCount: aired,
            announcedNext: sequel ? aniTitle(sequel.node.title) : null,
            announcedNextDate: sequel ? aniDate(sequel.node.startDate) : null,
            airCheckedAt: new Date(),
            malId: typeof m.idMal === "number" ? m.idMal : null,
            ...(await safeScores(() => jikanScore(typeof m.idMal === "number" ? m.idMal : null), `jikan ${item.title}`)),
        },
        credits: studios.map((s: any, i: number) => ({
            contributorId: `anilist-studio:${s.id}`,
            name: s.name,
            kind: "STUDIO" as const,
            role: "STUDIO" as const,
            order: i,
        })),
        franchise: root
            ? {
                  id: String(root.id),
                  title: aniTitle(root.title),
                  nativeTitle: root.title?.native ?? null,
                  posterUrl: root.coverImage?.extraLarge ?? root.coverImage?.large ?? null,
                  bannerUrl: root.bannerImage ?? null,
                  countryOfOrigin: root.countryOfOrigin ?? null,
                  status: root.status ?? null,
              }
            : undefined,
    };
}

/* ---------------------------- Google Books ---------------------------- */

async function openLibrarySearch(params: Record<string, string | number>): Promise<number | null> {
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const res = await axios.get("https://openlibrary.org/search.json", {
                params: { ...params, fields: "first_publish_year", limit: 1 },
                timeout: 12_000,
            });
            const y = res.data?.docs?.[0]?.first_publish_year;
            return typeof y === "number" ? y : null;
        } catch (err) {
            if (attempt === 1) throw err;
        }
    }
    return null;
}

/**
 * When the book first came out. By ISBN first; many editions aren't in Open
 * Library, so fall back to title + author ranked by edition count (the
 * original work beats graphic novels and study guides).
 */
async function openLibraryFirstYear(isbn: string | null, title: string, author?: string): Promise<number | null> {
    if (isbn) {
        const byIsbn = await openLibrarySearch({ isbn });
        if (byIsbn) return byIsbn;
    }
    return openLibrarySearch({
        q: `title:"${title}"${author ? ` author:"${author}"` : ""}`,
        sort: "editions",
    });
}

function httpsCover(url?: string | null) {
    return url ? url.replace(/^http:\/\//, "https://") : null;
}

async function enrichGoogleBook(item: MediaItem): Promise<Enrichment | null> {
    const res = await googleBooksGet(`/volumes/${encodeURIComponent(item.providerId)}`);
    const v = res?.volumeInfo;
    if (!v) return null;

    const authors: string[] = Array.isArray(v.authors) ? v.authors : [];
    const ids: any[] = v.industryIdentifiers ?? [];
    const isbn = ids.find((i) => i.type === "ISBN_13")?.identifier ?? ids.find((i) => i.type === "ISBN_10")?.identifier ?? null;
    const editionYear = Number(String(v.publishedDate ?? "").slice(0, 4)) || null;

    // Google returns an edition; Open Library knows when the book first came out.
    let firstYear: number | null = null;
    try {
        firstYear = await openLibraryFirstYear(isbn, v.title ?? item.title, authors[0]);
    } catch {
        firstYear = null;
    }
    const year = firstYear && (!editionYear || firstYear <= editionYear) ? firstYear : editionYear;

    return {
        data: {
            // Year is replaced: the stored one was the edition's.
            year: year ?? undefined,
            description: fill(item.description, v.description || null),
            posterUrl: httpsCover(item.posterUrl) ?? httpsCover(v.imageLinks?.thumbnail),
            genres: fill(item.genres, genresJson(v.categories)),
            pageCount: v.printedPageCount ?? v.pageCount ?? null,
            isbn,
            releaseDate: dateOrNull(v.publishedDate),
            originalLanguage: v.language ?? null,
            creator: authors.join(", ") || null,
            globalRating: typeof v.averageRating === "number" ? v.averageRating * 2 : undefined,
            globalRatingText:
                typeof v.ratingsCount === "number" ? `Google Books (${v.ratingsCount} ratings)` : undefined,
        },
        credits: authors.map((name, i) => ({
            contributorId: `author:${slug(name)}`,
            name,
            kind: "PERSON" as const,
            role: "AUTHOR" as const,
            order: i,
        })),
    };
}

/* ------------------------------- entry ------------------------------- */

export async function fetchEnrichment(item: MediaItem): Promise<Enrichment | null> {
    const provider = item.provider.toLowerCase();
    if (provider === "tmdb" && item.mediaType === "MOVIE") return enrichTmdbMovie(item);
    if (provider === "tmdb" && item.mediaType === "TV") return enrichTmdbTv(item);
    if (provider === "anilist") return enrichAnilist(item);
    if (provider === "googlebooks") return enrichGoogleBook(item);
    return null; // manual items have no provider
}

/** Writes an enrichment: franchise, item fields, region, credits. */
export async function saveEnrichment(item: MediaItem, e: Enrichment | null) {
    const now = new Date();
    if (!e) {
        await prisma.mediaItem.update({ where: { id: item.id }, data: { metaCheckedAt: now } });
        return;
    }

    const country =
        (e.data.countryOfOrigin as string | null | undefined) !== undefined
            ? (e.data.countryOfOrigin as string | null)
            : item.countryOfOrigin;

    const ops: Prisma.PrismaPromise<unknown>[] = [];
    if (e.franchise) {
        const { id, ...rest } = e.franchise;
        ops.push(prisma.franchise.upsert({ where: { id }, create: { id, ...rest }, update: rest }));
    }
    ops.push(
        prisma.mediaItem.update({
            where: { id: item.id },
            data: { ...e.data, region: regionForItem(item.mediaType, country), metaCheckedAt: now },
        })
    );

    // Contributors are shared across items: upsert them, then replace this item's credits.
    const seen = new Set<string>();
    for (const c of e.credits) {
        if (seen.has(c.contributorId)) continue;
        seen.add(c.contributorId);
        ops.push(
            prisma.contributor.upsert({
                where: { id: c.contributorId },
                create: { id: c.contributorId, name: c.name, kind: c.kind, imageUrl: c.imageUrl ?? null },
                update: { name: c.name, ...(c.imageUrl ? { imageUrl: c.imageUrl } : {}) },
            })
        );
    }
    ops.push(prisma.credit.deleteMany({ where: { mediaId: item.id } }));
    const unique = new Map<string, CreditInput>();
    for (const c of e.credits) unique.set(`${c.contributorId}|${c.role}`, c);
    if (unique.size) {
        ops.push(
            prisma.credit.createMany({
                data: [...unique.values()].map((c) => ({
                    mediaId: item.id,
                    contributorId: c.contributorId,
                    role: c.role,
                    character: c.character ?? null,
                    order: c.order,
                })),
            })
        );
    }

    await prisma.$transaction(ops);
}

const inFlight = new Map<string, Promise<{ ok: boolean; error?: string }>>();

/** Enriches one item; concurrent calls for the same item share one job. */
export function enrichItem(id: string): Promise<{ ok: boolean; error?: string }> {
    const running = inFlight.get(id);
    if (running) return running;
    const job = runEnrichment(id).finally(() => inFlight.delete(id));
    inFlight.set(id, job);
    return job;
}

async function runEnrichment(id: string): Promise<{ ok: boolean; error?: string }> {
    const item = await prisma.mediaItem.findUnique({ where: { id } });
    if (!item) return { ok: false, error: "not found" };
    try {
        await saveEnrichment(item, await fetchEnrichment(item));
        return { ok: true };
    } catch (err: any) {
        // Not marked as checked, so the next add/backfill retries it.
        return { ok: false, error: err?.message ?? String(err) };
    }
}

/**
 * Enriches in the background but waits up to `budgetMs` for it, so a quick
 * provider makes the response complete while a slow one doesn't block it.
 */
export async function enrichWithinBudget(id: string, budgetMs = 8000) {
    const job = enrichItem(id).then((r) => {
        if (!r.ok) console.error(`Enrichment failed for ${id}:`, r.error);
        return r;
    });
    await Promise.race([job, new Promise((r) => setTimeout(r, budgetMs))]);
}
