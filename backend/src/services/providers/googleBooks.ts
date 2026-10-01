import axios from "axios";

export async function googleBooksSearch(q: string) {
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=10`;
    const res = await axios.get(url);
    const items = res.data?.items ?? [];

    return items.map((b: any) => ({
        provider: "googlebooks",
        providerId: String(b.id),
        mediaType: "BOOK",
        title: b.volumeInfo?.title ?? "",
        year: b.volumeInfo?.publishedDate
            ? Number(String(b.volumeInfo.publishedDate).slice(0, 4)) || undefined
            : undefined,
        description: b.volumeInfo?.description ?? "",
        posterUrl: b.volumeInfo?.imageLinks?.thumbnail ?? null,
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
    const url = `https://www.googleapis.com/books/v1/volumes/${encodeURIComponent(providerId)}`;
    const res = await axios.get(url);
    const b = res.data;
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
        posterUrl: b.volumeInfo?.imageLinks?.thumbnail ?? null,
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
