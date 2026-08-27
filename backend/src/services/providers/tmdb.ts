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
            "User-Agent": "media-vault-backend",
        },
    });
}

const http = createClient();

// --------- GENRE MAP CACHE ----------
type GenreMapCache = {
    movie?: { at: number; map: Record<string, number> };
    tv?: { at: number; map: Record<string, number> };
};

const genreCache: GenreMapCache = {};
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

async function getGenreMap(kind: "movie" | "tv") {
    const cached = genreCache[kind];
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.map;

    if (!API_KEY) return {};

    const res = await requestWithRetry(() =>
        http.get(`/genre/${kind}/list`, { params: { api_key: API_KEY } })
    );

    const map: Record<string, number> = {};
    for (const g of res.data?.genres ?? []) {
        if (g?.name && g?.id) map[String(g.name).toLowerCase()] = Number(g.id);
    }

    genreCache[kind] = { at: Date.now(), map };
    return map;
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
    };
}


// --- existing search function (keep your exports if you already had them) ---
export async function tmdbSearch(query: string, type: "movie" | "tv") {
    if (!API_KEY) return [];
    const endpoint = type === "movie" ? "/search/movie" : "/search/tv";

    const res = await requestWithRetry(() =>
        http.get(endpoint, { params: { api_key: API_KEY, query } })
    );

    return (res.data?.results ?? []).map((r: any) => ({
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
    }));
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

    // If mapping fails, return empty (caller can fallback to search)
    if (ids.length === 0) return [];

    const res = await requestWithRetry(() =>
        http.get(endpoint, {
            params: {
                api_key: API_KEY,
                with_genres: ids.join(","),
                sort_by: "popularity.desc",
                include_adult: false,
                page,
            },
        })
    );

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
    }));
}
