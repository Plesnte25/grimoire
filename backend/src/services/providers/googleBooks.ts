import { trackProvider } from "../providerHealth.js";
import axios from "axios";

const API_KEY = process.env.GOOGLE_BOOKS_API_KEY;
const BASE = "https://www.googleapis.com/books/v1";

export function bestGoogleBookCover(imageLinks?: Record<string, string> | null, isbn?: string | null) {
    const googleCover = imageLinks?.extraLarge ?? imageLinks?.large ?? imageLinks?.medium ?? imageLinks?.thumbnail;
    if (googleCover) {
        const url = new URL(googleCover.replace(/^http:\/\//, "https://"));
        url.searchParams.set("zoom", "0");
        url.searchParams.delete("edge");
        return url.toString();
    }
    return isbn ? `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(isbn)}-L.jpg?default=false` : null;
}

function bookIsbn(volumeInfo: any): string | null {
    const ids = volumeInfo?.industryIdentifiers ?? [];
    return ids.find((entry: any) => entry.type === "ISBN_13")?.identifier
        ?? ids.find((entry: any) => entry.type === "ISBN_10")?.identifier
        ?? null;
}

function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
}

/**
 * GET against the Books API. Without GOOGLE_BOOKS_API_KEY requests share
 * Google's anonymous quota, which often answers 429, so back off and retry.
 */
export function googleBooksGet<T = any>(path: string, params: Record<string, any> = {}): Promise<T> {
    return trackProvider("googlebooks", () => googleBooksFetch<T>(path, params));
}

async function googleBooksFetch<T>(path: string, params: Record<string, any>): Promise<T> {
    let wait = 2000;
    for (let attempt = 0; ; attempt++) {
        try {
            const res = await axios.get(`${BASE}${path}`, {
                params: { ...params, ...(API_KEY ? { key: API_KEY } : {}) },
                timeout: 12_000,
            });
            return res.data as T;
        } catch (err: any) {
            if (err?.response?.status !== 429 || attempt >= 3) throw err;
            await sleep(wait);
            wait *= 2;
        }
    }
}

export async function googleBooksSearch(q: string) {
    const data = await googleBooksGet("/volumes", { q, maxResults: 10 });
    const items = data?.items ?? [];

    return items.map((b: any) => ({
        provider: "googlebooks",
        providerId: String(b.id),
        mediaType: "BOOK",
        title: b.volumeInfo?.title ?? "",
        year: b.volumeInfo?.publishedDate
            ? Number(String(b.volumeInfo.publishedDate).slice(0, 4)) || undefined
            : undefined,
        description: b.volumeInfo?.description ?? "",
        posterUrl: bestGoogleBookCover(b.volumeInfo?.imageLinks, bookIsbn(b.volumeInfo)),
        backdropUrl: null,
        // Google rates 0–5; every online score in Grimoire is stored on 0–10.
        globalRating:
            typeof b.volumeInfo?.averageRating === "number" ? b.volumeInfo.averageRating * 2 : undefined,
        globalRatingText:
            typeof b.volumeInfo?.ratingsCount === "number"
                ? `Google Books (${b.volumeInfo.ratingsCount} ratings)`
                : undefined,
        genres: Array.isArray(b.volumeInfo?.categories) ? b.volumeInfo.categories : [],
    }));
}

export async function googleBooksDetails(providerId: string) {
    const b = await googleBooksGet(`/volumes/${encodeURIComponent(providerId)}`);
    if (!b) return null;

    return {
        provider: "googlebooks",
        providerId: String(b.id),
        mediaType: "BOOK",
        title: b.volumeInfo?.title ?? "",
        year: b.volumeInfo?.publishedDate
            ? Number(String(b.volumeInfo.publishedDate).slice(0, 4)) || undefined
            : undefined,
        description: b.volumeInfo?.description ?? "",
        posterUrl: bestGoogleBookCover(b.volumeInfo?.imageLinks, bookIsbn(b.volumeInfo)),
        backdropUrl: null,
        // Google rates 0–5; every online score in Grimoire is stored on 0–10.
        globalRating:
            typeof b.volumeInfo?.averageRating === "number" ? b.volumeInfo.averageRating * 2 : undefined,
        globalRatingText:
            typeof b.volumeInfo?.ratingsCount === "number"
                ? `Google Books (${b.volumeInfo.ratingsCount} ratings)`
                : undefined,
        genres: Array.isArray(b.volumeInfo?.categories) ? b.volumeInfo.categories : [],
    };
}

// ✅ NEW: batch “discover” by ids
export async function googleBooksDiscoverByIds(ids: string[]) {
    const out: any[] = [];
    for (const id of ids.slice(0, 20)) {
        try {
            const d = await googleBooksDetails(id);
            if (d) out.push(d);
        } catch {
            // ignore individual failures
        }
    }
    return out;
}
