import axios, { AxiosError, AxiosInstance } from "axios";

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMAGE = "https://image.tmdb.org/t/p";
const API_KEY = process.env.TMDB_API_KEY;

// --- axios with retry for flaky TLS/ECONNRESET ---
function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
}

function isRetryable(err: any) {
    const e = err as AxiosError;
    const code = (e as any)?.code;
    const status = e.response?.status;

    // network/tls drops
    if (code === "ECONNRESET" || code === "ETIMEDOUT" || code === "EAI_AGAIN") return true;

    // tmdb transient
    if (status && [429, 500, 502, 503, 504].includes(status)) return true;

    return false;
}

async function requestWithRetry<T>(fn: () => Promise<T>, retries = 3) {
    let last: any;
    for (let i = 0; i <= retries; i++) {
        try {
            return await fn();
        } catch (e) {
            last = e;
            if (!isRetryable(e) || i === retries) throw e;
            // exponential-ish backoff
            await sleep(250 * Math.pow(2, i));
        }
    }
    throw last;
}

function createClient(): AxiosInstance {
    return axios.create({
        baseURL: TMDB_BASE,
        timeout: 12_000,
        headers: {
            Accept: "application/json",
            "User-Agent": "grimoire-backend",
        },
    });
}

const http = createClient();

/** Raw TMDB GET with the shared retry policy (used by the enrichment service). */
export async function tmdbGet<T = any>(path: string, params: Record<string, any> = {}): Promise<T | null> {
    if (!API_KEY) return null;
    const res = await requestWithRetry(() => http.get(path, { params: { api_key: API_KEY, ...params } }));
    return res.data as T;
}

export const TMDB_IMAGE_BASE = TMDB_IMAGE;

// --------- GENRE MAP CACHE ----------
type GenreMapEntry = { at: number; nameToId: Record<string, number>; idToName: Record<number, string> };
type GenreMapCache = {
    movie?: GenreMapEntry;
    tv?: GenreMapEntry;
};

const genreCache: GenreMapCache = {};
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

async function getGenreMapEntry(kind: "movie" | "tv"): Promise<GenreMapEntry> {
    const cached = genreCache[kind];
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached;

    if (!API_KEY) return { at: Date.now(), nameToId: {}, idToName: {} };

    const res = await requestWithRetry(() =>
        http.get(`/genre/${kind}/list`, { params: { api_key: API_KEY } })
    );

    const nameToId: Record<string, number> = {};
    const idToName: Record<number, string> = {};
    for (const g of res.data?.genres ?? []) {
        if (g?.name && g?.id) {
            nameToId[String(g.name).toLowerCase()] = Number(g.id);
            idToName[Number(g.id)] = String(g.name);
        }
    }

    const entry = { at: Date.now(), nameToId, idToName };
    genreCache[kind] = entry;
    return entry;
}

async function getGenreMap(kind: "movie" | "tv") {
    return (await getGenreMapEntry(kind)).nameToId;
}

async function getGenreIdToName(kind: "movie" | "tv") {
    return (await getGenreMapEntry(kind)).idToName;
}

function toPoster(url?: string | null) {
    if (!url) return null;
    if (url.startsWith("http")) return url;
    return `${TMDB_IMAGE}/w500${url}`;
}
function toBackdrop(url?: string | null) {
    if (!url) return null;
    if (url.startsWith("http")) return url;
    return `${TMDB_IMAGE}/w780${url}`;
}

// --- NEW: details fetch (used by /api/providers/details) ---
export async function tmdbDetails(providerId: string, type: "movie" | "tv") {
    if (!API_KEY) return null;

    const endpoint = type === "movie" ? `/movie/${providerId}` : `/tv/${providerId}`;

    const res = await requestWithRetry(() =>
        http.get(endpoint, { params: { api_key: API_KEY } })
    );

    const r: any = res.data;

    return {
        provider: "tmdb",
        providerId: String(r.id),
        mediaType: type === "movie" ? "MOVIE" : "TV",
        title: r.title ?? r.name ?? "",
        year:
            type === "movie"
                ? Number(String(r.release_date || "").slice(0, 4)) || undefined
                : Number(String(r.first_air_date || "").slice(0, 4)) || undefined,
        description: r.overview ?? "",
        posterUrl: toPoster(r.poster_path),
        backdropUrl: toBackdrop(r.backdrop_path),
        globalRating: typeof r.vote_average === "number" ? r.vote_average : undefined,
        globalRatingText:
            typeof r.vote_count === "number" ? `TMDB (${r.vote_count} votes)` : undefined,
        // IMPORTANT: return genres as array of names (library.ts can stringify if DB expects string)
        genres: Array.isArray(r.genres) ? r.genres.map((g: any) => g?.name).filter(Boolean) : [],
        runtime:
            type === "movie"
                ? (typeof r.runtime === "number" ? r.runtime : undefined)
                : undefined,
        seasons:
            type === "tv"
                ? (typeof r.number_of_seasons === "number" ? r.number_of_seasons : undefined)
                : undefined,
        episodes:
            type === "tv"
                ? (typeof r.number_of_episodes === "number" ? r.number_of_episodes : undefined)
                : undefined,
        // Franchise grouping — TMDB only has a "collection" concept for movies, not TV.
        collectionId:
            type === "movie" && r.belongs_to_collection?.id != null
                ? String(r.belongs_to_collection.id)
                : undefined,
        collectionName:
            type === "movie" ? r.belongs_to_collection?.name ?? undefined : undefined,
    };
}


// Main language per country, to spot dubbed re-uploads ("Ertugrul Ghazi Urdu" is
// listed as country TR but language ur). Countries with several languages (IN,
// CH, BE…) are left out rather than guessed.
const COUNTRY_LANGUAGE: Record<string, string[]> = {
    TR: ["tr"], PK: ["ur", "pa"], KR: ["ko"], JP: ["ja"], CN: ["zh", "cn"], TW: ["zh"], ES: ["es", "ca", "eu", "gl"],
    MX: ["es"], DE: ["de"], AT: ["de"], FR: ["fr"], IT: ["it"], NO: ["no", "nb", "nn"], SE: ["sv"], DK: ["da"],
    FI: ["fi"], PL: ["pl"], NL: ["nl"], PT: ["pt"], BR: ["pt"], US: ["en"], GB: ["en"], IE: ["en", "ga"],
    AU: ["en"], CA: ["en", "fr"],
};

function looksDubbed(r: any): boolean {
    if (/\b(urdu|hindi|dubbed|dub|in hindi|in urdu)\b/i.test(r.name ?? r.title ?? "")) return true;
    const country = r.origin_country?.[0];
    const langs = country ? COUNTRY_LANGUAGE[country] : undefined;
    return !!(langs && r.original_language && !langs.includes(r.original_language));
}

function mapSearchResult(r: any, type: "movie" | "tv") {
    const title = r.title ?? r.name ?? "";
    const original = r.original_title ?? r.original_name ?? null;
    return {
        provider: "tmdb",
        providerId: String(r.id),
        mediaType: type === "movie" ? "MOVIE" : "TV",
        title,
        nativeTitle: original && original !== title ? original : undefined,
        year:
            type === "movie"
                ? Number(String(r.release_date || "").slice(0, 4)) || undefined
                : Number(String(r.first_air_date || "").slice(0, 4)) || undefined,
        description: r.overview ?? "",
        posterUrl: toPoster(r.poster_path),
        backdropUrl: toBackdrop(r.backdrop_path),
        globalRating: typeof r.vote_average === "number" ? r.vote_average : undefined,
        globalRatingText:
            typeof r.vote_count === "number" ? `TMDB (${r.vote_count} votes)` : undefined,
        countryOfOrigin: r.origin_country?.[0] ?? undefined,
        originalLanguage: r.original_language ?? undefined,
        isDub: looksDubbed(r),
        popularity: typeof r.popularity === "number" ? r.popularity : 0,
    };
}

async function searchOnce(query: string, type: "movie" | "tv") {
    const endpoint = type === "movie" ? "/search/movie" : "/search/tv";
    const res = await requestWithRetry(() => http.get(endpoint, { params: { api_key: API_KEY, query } }));
    return (res.data?.results ?? []).map((r: any) => mapSearchResult(r, type));
}

// Urdu titles have no fixed romanisation: "Mere Paas Tum Ho" is listed as
// "Meray Paas Tum Ho". Each pair is tried in both directions.
const ROMANISATION_PAIRS: [string, string][] = [
    ["mere", "meray"], ["tere", "teray"], ["hai", "hay"], ["ki", "kee"], ["se", "say"],
    ["mein", "main"], ["aur", "or"], ["ye", "yeh"], ["wo", "woh"], ["ishq", "ishk"], ["e", "ay"],
];

/** Spelling variants of a query (one swap at a time, then all swaps together). */
export function romanisationVariants(query: string): string[] {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const swap = (w: string) => {
        for (const [a, b] of ROMANISATION_PAIRS) {
            if (w === a) return b;
            if (w === b) return a;
        }
        return null;
    };
    const variants = new Set<string>();
    const all = words.map((w) => swap(w) ?? w);
    words.forEach((w, i) => {
        const s = swap(w);
        if (s) variants.add([...words.slice(0, i), s, ...words.slice(i + 1)].join(" "));
    });
    variants.add(all.join(" "));
    variants.delete(words.join(" "));
    return [...variants].slice(0, 4);
}

export async function tmdbSearch(query: string, type: "movie" | "tv") {
    if (!API_KEY) return [];
    const first = await searchOnce(query, type);
    if (first.length >= 3) return first;

    // Few hits: try spelling variants and merge (Pakistani titles especially).
    const seen = new Set(first.map((r: any) => r.providerId));
    const merged = [...first];
    for (const v of romanisationVariants(query)) {
        for (const r of await searchOnce(v, type).catch(() => [])) {
            if (!seen.has(r.providerId)) {
                seen.add(r.providerId);
                merged.push(r);
            }
        }
    }
    return merged;
}

// --- NEW: Discover by genre ids ---
export async function tmdbDiscoverByGenres(params: {
    kind: "movie" | "tv";
    genreNames: string[]; // ex: ["Drama","Thriller"]
    page?: number;
}) {
    if (!API_KEY) return [];

    const { kind, genreNames } = params;
    const page = params.page ?? 1;
    const endpoint = kind === "movie" ? "/discover/movie" : "/discover/tv";

    const map = await getGenreMap(kind);

    const ids = genreNames
        .map((g) => map[String(g).toLowerCase()])
        .filter(Boolean)
        .slice(0, 3);

    // If genre-name mapping fails entirely, fall back to unfiltered popularity
    // discover rather than returning nothing.
    const queryParams: Record<string, any> = {
        api_key: API_KEY,
        sort_by: "popularity.desc",
        include_adult: false,
        page,
    };
    if (ids.length > 0) queryParams.with_genres = ids.join(",");

    const res = await requestWithRetry(() => http.get(endpoint, { params: queryParams }));

    // discover results only carry genre_ids, not names
    const idToName = await getGenreIdToName(kind);

    return (res.data?.results ?? []).map((r: any) => ({
        provider: "tmdb",
        providerId: String(r.id),
        mediaType: kind === "movie" ? "MOVIE" : "TV",
        title: r.title ?? r.name ?? "",
        year:
            kind === "movie"
                ? Number(String(r.release_date || "").slice(0, 4)) || undefined
                : Number(String(r.first_air_date || "").slice(0, 4)) || undefined,
        description: r.overview ?? "",
        posterUrl: toPoster(r.poster_path),
        backdropUrl: toBackdrop(r.backdrop_path),
        globalRating: typeof r.vote_average === "number" ? r.vote_average : undefined,
        globalRatingText:
            typeof r.vote_count === "number" ? `TMDB (${r.vote_count} votes)` : undefined,
        genres: Array.isArray(r.genre_ids)
            ? r.genre_ids.map((gid: number) => idToName[gid]).filter(Boolean)
            : [],
    }));
}

export async function tmdbRecommendations(params: {
    kind: "movie" | "tv";
    providerId: string;
    page?: number;
}) {
    if (!API_KEY) return [];

    const page = params.page ?? 1;
    const endpoint = `/${params.kind}/${params.providerId}/recommendations`;
    const res = await requestWithRetry(() =>
        http.get(endpoint, {
            params: {
                api_key: API_KEY,
                include_adult: false,
                page,
            },
        })
    );
    const idToName = await getGenreIdToName(params.kind);

    return (res.data?.results ?? []).map((r: any) => ({
        provider: "tmdb",
        providerId: String(r.id),
        mediaType: params.kind === "movie" ? "MOVIE" : "TV",
        title: r.title ?? r.name ?? "",
        year:
            params.kind === "movie"
                ? Number(String(r.release_date || "").slice(0, 4)) || undefined
                : Number(String(r.first_air_date || "").slice(0, 4)) || undefined,
        description: r.overview ?? "",
        posterUrl: toPoster(r.poster_path),
        backdropUrl: toBackdrop(r.backdrop_path),
        globalRating: typeof r.vote_average === "number" ? r.vote_average : undefined,
        globalRatingText:
            typeof r.vote_count === "number" ? `TMDB (${r.vote_count} votes)` : undefined,
        genres: Array.isArray(r.genre_ids)
            ? r.genre_ids.map((gid: number) => idToName[gid]).filter(Boolean)
            : [],
    }));
}
