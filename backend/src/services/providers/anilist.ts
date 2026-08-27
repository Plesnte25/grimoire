import axios from "axios";

const ENDPOINT = "https://graphql.anilist.co";

const CACHE = new Map<string, { at: number; ttl: number; data: any }>();

function cacheGet<T>(key: string): T | null {
  const v = CACHE.get(key);
  if (!v) return null;
  if (Date.now() - v.at > v.ttl) {
    CACHE.delete(key);
    return null;
  }
  return v.data as T;
}

function cacheSet(key: string, data: any, ttlMs: number) {
  CACHE.set(key, { at: Date.now(), ttl: ttlMs, data });
}


let chain: Promise<any> = Promise.resolve();
let blockedUntil = 0;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function postAniList<T>(payload: any, cacheKey?: string, ttlMs = 10 * 60 * 1000): Promise<T> {
  // Fast path: cache hit
  if (cacheKey) {
    const cached = cacheGet<T>(cacheKey);
    if (cached) return cached;
  }

  // Queue requests one-by-one
  chain = chain.then(async () => {
    const now = Date.now();
    if (blockedUntil > now) {
      await sleep(blockedUntil - now);
    }

    try {
      const res = await axios.post(ENDPOINT, payload, {
        headers: { "Content-Type": "application/json" },
        timeout: 15000,
      });

      if (cacheKey) cacheSet(cacheKey, res.data, ttlMs);
      return res.data as T;
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 429) {
        // Respect retry-after header (seconds). If missing, default 3s
        const raRaw = err?.response?.headers?.["retry-after"];
        const retryAfterSec = Number(raRaw);
        const waitMs = Number.isFinite(retryAfterSec) ? retryAfterSec * 1000 : 3000;

        blockedUntil = Date.now() + waitMs;

        // Retry once after waiting
        await sleep(waitMs);

        const res2 = await axios.post(ENDPOINT, payload, {
          headers: { "Content-Type": "application/json" },
          timeout: 15000,
        });

        if (cacheKey) cacheSet(cacheKey, res2.data, ttlMs);
        return res2.data as T;
      }

      throw err;
    }
  });

  return chain;
}

/* ------------------------------------------------------------------ */

function pickTitle(t: any) {
  return t?.english ?? t?.romaji ?? t?.native ?? "";
}

function mapMedia(m: any) {
  return {
    provider: "anilist",
    providerId: String(m.id),
    mediaType: "ANIME",
    title: pickTitle(m.title),
    nativeTitle: m?.title?.native ?? undefined,
    year: m?.seasonYear ?? undefined,
    description: m?.description ?? "",
    posterUrl: m?.coverImage?.extraLarge ?? m?.coverImage?.large ?? null,
    backdropUrl: m?.bannerImage ?? null,
    globalRating: typeof m?.averageScore === "number" ? m.averageScore / 10 : undefined,
    globalRatingText:
      typeof m?.averageScore === "number" ? `AniList (${m.averageScore})` : undefined,
    genres: Array.isArray(m?.genres) ? m.genres : [],
    format: m?.format ?? undefined,
    isAdult: !!m?.isAdult,
    episodes: typeof m?.episodes === "number" ? m.episodes : undefined,
    duration: typeof m?.duration === "number" ? m.duration : undefined,
  };
}


export async function anilistSearch(search: string) {
  const query = `
    query ($search: String) {
      Page(perPage: 10) {
        media(search: $search, type: ANIME) {
          id format episodes duration isAdult
          title { romaji english native }
          description(asHtml: false)
          averageScore genres
          coverImage { extraLarge large }
          bannerImage seasonYear
        }
      }
    }
  `;

  const cacheKey = `search:${search.toLowerCase().trim()}`;
  const data = await postAniList<any>({ query, variables: { search } }, cacheKey, 2 * 60 * 1000);
  return (data?.data?.Page?.media ?? []).map(mapMedia);
}

export async function anilistDetails(providerId: string) {
  const id = Number(providerId);
  if (!Number.isFinite(id)) return null;

  const query = `
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        id format episodes duration isAdult
        title { romaji english native }
        description(asHtml: false)
        averageScore genres
        coverImage { extraLarge large }
        bannerImage seasonYear
      }
    }
  `;

  const cacheKey = `details:${id}`;
  const data = await postAniList<any>({ query, variables: { id } }, cacheKey, 24 * 60 * 60 * 1000);
  const m = data?.data?.Media;
  return m ? mapMedia(m) : null;
}

export async function anilistDiscoverByIds(ids: string[]) {
  const cleanIds = ids.map((x) => Number(x)).filter((n) => Number.isFinite(n));
  if (!cleanIds.length) return [];

  const query = `
    query ($ids: [Int]) {
      Page(perPage: 25) {
        media(id_in: $ids, type: ANIME) {
          id format episodes duration isAdult
          title { romaji english native }
          description(asHtml: false)
          averageScore genres
          coverImage { extraLarge large }
          bannerImage seasonYear
        }
      }
    }
  `;

  const cacheKey = `ids:${cleanIds.sort((a, b) => a - b).join(",")}`;
  const data = await postAniList<any>({ query, variables: { ids: cleanIds } }, cacheKey, 10 * 60 * 1000);
  return (data?.data?.Page?.media ?? []).map(mapMedia);
}

export async function anilistDiscoverByGenres(opts: {
  genreNames: string[];
  page?: number;
  scope?: "SERIES" | "MOVIES" | "HENTAI";
}) {
  const page = opts.page ?? 1;
  const scope = opts.scope ?? "SERIES";

  const formats =
    scope === "MOVIES"
      ? ["MOVIE"]
      : scope === "SERIES"
        ? ["TV", "TV_SHORT", "OVA", "ONA", "SPECIAL"]
        : undefined;

  const isAdult = scope === "HENTAI" ? true : undefined;

  const variables: any = {
    page,
    genres: (opts.genreNames ?? []).filter(Boolean),
  };
  if (formats) variables.formats = formats;
  if (typeof isAdult === "boolean") variables.isAdult = isAdult;

  const query = `
    query ($page: Int, $genres: [String], $formats: [MediaFormat], $isAdult: Boolean) {
      Page(page: $page, perPage: 25) {
        media(
          type: ANIME,
          sort: POPULARITY_DESC,
          genre_in: $genres,
          format_in: $formats,
          isAdult: $isAdult
        ) {
          id format episodes duration isAdult
          title { romaji english native }
          description(asHtml: false)
          averageScore genres
          coverImage { extraLarge large }
          bannerImage seasonYear
        }
      }
    }
  `;

  const cacheKey = `discover:${scope}:${page}:${variables.genres.join("|")}`;
  const data = await postAniList<any>({ query, variables }, cacheKey, 3 * 60 * 1000);

  return (data?.data?.Page?.media ?? []).map(mapMedia);
}
