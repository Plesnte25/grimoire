import { prisma } from "../db.js";
import { tmdbGet, TMDB_IMAGE_BASE } from "./providers/tmdb.js";
import { postAniList } from "./providers/anilist.js";
import { TV_FORMATS, aniDate, aniOrder, aniTitle, animeEdges, fetchAnime } from "./enrich.js";

// Read-only catalogue views that mix provider data with what's in the library:
// a franchise's full map, a TMDB movie collection, a person's or studio's work.

export type CatalogEntry = {
    provider: "anilist" | "tmdb";
    providerId: string;
    mediaType: "ANIME" | "MOVIE" | "TV";
    title: string;
    format?: string | null;
    role?: string | null; // franchise: MAIN | MOVIE | OVA | ONA | SPECIAL; person: their job
    year?: number | null;
    date?: string | null;
    status?: string | null;
    posterUrl?: string | null;
    // Set when the entry is in your library.
    libraryId?: string;
    yourStatus?: string;
    yourRating?: number | null;
};

const CACHE = new Map<string, { at: number; data: unknown }>();
const TTL_MS = 12 * 60 * 60 * 1000;

async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
    const hit = CACHE.get(key);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.data as T;
    const data = await load();
    CACHE.set(key, { at: Date.now(), data });
    return data;
}

/** Marks entries that are in the library with your status and rating. */
async function withLibrary(entries: CatalogEntry[]): Promise<CatalogEntry[]> {
    if (!entries.length) return entries;
    const items = await prisma.mediaItem.findMany({
        where: {
            OR: entries.map((e) => ({ provider: e.provider, providerId: e.providerId })),
        },
        select: { id: true, provider: true, providerId: true, status: true, yourRating: true },
    });
    const byKey = new Map(items.map((i) => [`${i.provider}:${i.providerId}`, i]));
    return entries.map((e) => {
        const it = byKey.get(`${e.provider}:${e.providerId}`);
        return it ? { ...e, libraryId: it.id, yourStatus: it.status, yourRating: it.yourRating } : e;
    });
}

/* ------------------------------ franchise ------------------------------ */

// Relations that hang a side entry off a main-line season. SPIN_OFF and
// ALTERNATIVE are separate works (FMA vs Brotherhood), so they're left out.
const SIDE_RELATIONS = new Set(["SEQUEL", "PREQUEL", "SIDE_STORY", "SUMMARY", "CHILD"]);

function roleFor(format: string, onMainLine: boolean): string {
    if (onMainLine) return "MAIN";
    if (format === "MOVIE") return "MOVIE";
    if (format === "OVA") return "OVA";
    if (format === "ONA") return "ONA";
    return "SPECIAL";
}

function nodeEntry(node: any, role: string): CatalogEntry {
    return {
        provider: "anilist",
        providerId: String(node.id),
        mediaType: "ANIME",
        title: aniTitle(node.title),
        format: node.format ?? null,
        role,
        year: node.startDate?.year ?? null,
        date: aniDate(node.startDate)?.toISOString() ?? null,
        status: node.status ?? null,
        posterUrl: node.coverImage?.extraLarge ?? node.coverImage?.large ?? null,
    };
}

/**
 * Every entry of an anime franchise: the main line followed from the root via
 * SEQUEL (bridging through an OVA/movie when a season's sequel is listed on
 * one, e.g. Slime S1 → OVA → S2), plus each season's side entries.
 */
async function loadFranchiseMap(rootId: number): Promise<CatalogEntry[]> {
    const root = await fetchAnime(rootId);
    if (!root) return [];
    const onaLed = root.format === "ONA";
    const isMain = (fmt: string) => TV_FORMATS.has(fmt) || (onaLed && fmt === "ONA");

    const entries = new Map<number, CatalogEntry>();
    const visited = new Set<number>([root.id]);
    let current: any = root;
    for (let fetches = 0; current && fetches < 40; fetches++) {
        entries.set(current.id, nodeEntry(current, "MAIN"));

        for (const rel of SIDE_RELATIONS) {
            for (const e of animeEdges(current, rel)) {
                if (isMain(e.node.format) || e.node.format === "MUSIC" || entries.has(e.node.id)) continue;
                entries.set(e.node.id, nodeEntry(e.node, roleFor(e.node.format, false)));
            }
        }

        const nextMain = animeEdges(current, "SEQUEL")
            .filter((e: any) => !visited.has(e.node.id) && isMain(e.node.format))
            .sort((a: any, b: any) => aniOrder(a.node.startDate) - aniOrder(b.node.startDate))[0];
        if (nextMain) {
            visited.add(nextMain.node.id);
            current = await fetchAnime(nextMain.node.id);
            continue;
        }

        // Bridge: a side sequel whose own sequel is the next season.
        const season = current;
        current = null;
        const sideSequels = animeEdges(season, "SEQUEL").filter(
            (e: any) => !visited.has(e.node.id) && !isMain(e.node.format)
        );
        for (const side of sideSequels) {
            visited.add(side.node.id);
            const sideFull = await fetchAnime(side.node.id);
            const target = sideFull
                ? animeEdges(sideFull, "SEQUEL").find((e: any) => !visited.has(e.node.id) && isMain(e.node.format))
                : null;
            if (target) {
                visited.add(target.node.id);
                current = await fetchAnime(target.node.id);
                break;
            }
        }
    }

    const ROLE_ORDER: Record<string, number> = { MAIN: 0, MOVIE: 1, OVA: 2, ONA: 2, SPECIAL: 3 };
    return [...entries.values()].sort(
        (a, b) =>
            (ROLE_ORDER[a.role ?? "SPECIAL"] ?? 9) - (ROLE_ORDER[b.role ?? "SPECIAL"] ?? 9) ||
            (a.date ?? "9999").localeCompare(b.date ?? "9999")
    );
}

export async function franchiseView(franchiseId: string) {
    const franchise = await prisma.franchise.findUnique({ where: { id: franchiseId } });
    if (!franchise) return null;
    const entries = await cached(`franchise:${franchiseId}`, () => loadFranchiseMap(Number(franchiseId)));

    // Library entries the map doesn't know (AniList data shifts) still show up.
    const tracked = await prisma.mediaItem.findMany({
        where: { franchiseId },
        select: { provider: true, providerId: true, title: true, format: true, franchiseRole: true, year: true, posterUrl: true, releaseDate: true },
    });
    const known = new Set(entries.map((e) => e.providerId));
    const extra: CatalogEntry[] = tracked
        .filter((t) => !known.has(t.providerId))
        .map((t) => ({
            provider: "anilist",
            providerId: t.providerId,
            mediaType: "ANIME",
            title: t.title,
            format: t.format,
            role: t.franchiseRole,
            year: t.year,
            date: t.releaseDate?.toISOString() ?? null,
            posterUrl: t.posterUrl,
        }));

    return { franchise, entries: await withLibrary([...entries, ...extra]) };
}

/* ----------------------------- collections ----------------------------- */

export async function collectionView(collectionId: string) {
    const data = await cached(`collection:${collectionId}`, async () => {
        const c = await tmdbGet(`/collection/${collectionId}`);
        if (!c) return null;
        const parts: CatalogEntry[] = (c.parts ?? [])
            .map((p: any) => ({
                provider: "tmdb" as const,
                providerId: String(p.id),
                mediaType: "MOVIE" as const,
                title: p.title,
                year: Number(String(p.release_date ?? "").slice(0, 4)) || null,
                date: p.release_date || null,
                status: p.release_date && new Date(p.release_date) > new Date() ? "UPCOMING" : "RELEASED",
                posterUrl: p.poster_path ? `${TMDB_IMAGE_BASE}/w500${p.poster_path}` : null,
            }))
            .sort((a: CatalogEntry, b: CatalogEntry) => (a.date ?? "9999").localeCompare(b.date ?? "9999"));
        return {
            id: collectionId,
            name: c.name as string,
            overview: (c.overview as string) || null,
            backdropUrl: c.backdrop_path ? `${TMDB_IMAGE_BASE}/w780${c.backdrop_path}` : null,
            parts,
        };
    });
    if (!data) return null;
    return { ...data, parts: await withLibrary(data.parts) };
}

/* --------------------------- people & studios --------------------------- */

async function tmdbPersonWork(personId: string): Promise<{ bio: string | null; work: CatalogEntry[] }> {
    const p = await tmdbGet(`/person/${personId}`, { append_to_response: "combined_credits" });
    if (!p) return { bio: null, work: [] };
    // Talk, news and reality shows, and appearances as themselves, aren't "work".
    const NON_WORK_GENRES = new Set([10763, 10764, 10767]);
    const isWork = (c: any) =>
        !(c.genre_ids ?? []).some((g: number) => NON_WORK_GENRES.has(g)) &&
        !/\b(self|himself|herself|themselves)\b/i.test(c.character ?? "");
    const credits = [
        ...(p.combined_credits?.crew ?? []).filter((c: any) => ["Director", "Creator", "Writer", "Screenplay"].includes(c.job)),
        ...(p.combined_credits?.cast ?? []),
    ].filter(isWork);
    // One entry per title, labelled with the person's most significant job on it.
    const JOB_RANK: Record<string, number> = { Director: 0, Creator: 1, Writer: 2, Screenplay: 3 };
    const rank = (c: any) => JOB_RANK[c.job] ?? 4;
    const best = new Map<string, any>();
    for (const c of credits) {
        if (c.media_type !== "movie" && c.media_type !== "tv") continue;
        const key = `${c.media_type}:${c.id}`;
        const prev = best.get(key);
        if (!prev || rank(c) < rank(prev)) best.set(key, c);
    }
    const work: CatalogEntry[] = [];
    for (const c of [...best.values()].sort((a: any, b: any) => (b.popularity ?? 0) - (a.popularity ?? 0))) {
        const date = c.release_date || c.first_air_date || null;
        work.push({
            provider: "tmdb",
            providerId: String(c.id),
            mediaType: c.media_type === "movie" ? "MOVIE" : "TV",
            title: c.title ?? c.name,
            role: c.job ?? (c.character ? `as ${c.character}` : "Cast"),
            year: Number(String(date ?? "").slice(0, 4)) || null,
            date,
            posterUrl: c.poster_path ? `${TMDB_IMAGE_BASE}/w500${c.poster_path}` : null,
        });
        if (work.length >= 30) break;
    }
    return { bio: p.biography || null, work };
}

async function anilistStudioWork(studioId: string): Promise<{ bio: null; work: CatalogEntry[] }> {
    const data = await postAniList<any>(
        {
            query: `query ($id: Int) { Studio(id: $id) { media(sort: POPULARITY_DESC, isMain: true, perPage: 30) {
              nodes { id type format status startDate { year month day } title { romaji english native } coverImage { extraLarge large } } } } }`,
            variables: { id: Number(studioId) },
        },
        `studio:${studioId}`,
        TTL_MS
    );
    const nodes = (data?.data?.Studio?.media?.nodes ?? []).filter((n: any) => n.type === "ANIME");
    return { bio: null, work: nodes.map((n: any) => nodeEntry(n, n.format ?? null)) };
}

export async function contributorView(contributorId: string) {
    const contributor = await prisma.contributor.findUnique({
        where: { id: contributorId },
        include: {
            credits: {
                include: {
                    media: {
                        select: { id: true, title: true, mediaType: true, year: true, posterUrl: true, status: true, yourRating: true, provider: true, providerId: true },
                    },
                },
            },
        },
    });
    if (!contributor) return null;

    const [source, externalId] = contributorId.split(/:(.+)/);
    let other: { bio: string | null; work: CatalogEntry[] } = { bio: null, work: [] };
    try {
        if (source === "tmdb-person") other = await cached(contributorId, () => tmdbPersonWork(externalId));
        else if (source === "anilist-studio") other = await cached(contributorId, () => anilistStudioWork(externalId));
    } catch (err) {
        console.error("Contributor work lookup failed:", contributorId, err);
    }

    const yours = new Set(contributor.credits.map((c) => `${c.media.provider}:${c.media.providerId}`));
    return {
        contributor: { id: contributor.id, name: contributor.name, kind: contributor.kind, imageUrl: contributor.imageUrl },
        bio: other.bio,
        yours: contributor.credits.map((c) => ({ ...c.media, role: c.role, character: c.character })),
        otherWork: await withLibrary(other.work.filter((w) => !yours.has(`${w.provider}:${w.providerId}`))),
    };
}
