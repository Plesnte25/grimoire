import axios from "axios";

export async function itunesSearch(q: string) {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=song&limit=10`;
    const res = await axios.get(url);
    const items = res.data?.results ?? [];

    return items.map((t: any) => ({
        provider: "itunes",
        providerId: String(t.trackId ?? t.collectionId ?? ""),
        mediaType: "MUSIC",
        title: t.trackName ?? t.collectionName ?? "",
        year: t.releaseDate ? Number(String(t.releaseDate).slice(0, 4)) || undefined : undefined,
        description: t.artistName ? `By ${t.artistName}` : "",
        posterUrl: t.artworkUrl100 ?? t.artworkUrl60 ?? null,
        backdropUrl: null,
        globalRating: undefined,
        globalRatingText: "iTunes",
        genres: t.primaryGenreName ? [t.primaryGenreName] : [],
        collectionId: t.collectionId != null ? String(t.collectionId) : undefined,
        collectionName: t.collectionName ?? undefined,
    }));
}

export async function itunesLookupById(id: string) {
    const url = `https://itunes.apple.com/lookup?id=${encodeURIComponent(id)}`;
    const res = await axios.get(url);
    const t = (res.data?.results ?? [])[0];
    if (!t) return null;

    return {
        provider: "itunes",
        providerId: String(t.trackId ?? t.collectionId ?? id),
        mediaType: "MUSIC",
        title: t.trackName ?? t.collectionName ?? "",
        year: t.releaseDate ? Number(String(t.releaseDate).slice(0, 4)) || undefined : undefined,
        description: t.artistName ? `By ${t.artistName}` : "",
        posterUrl: t.artworkUrl100 ?? t.artworkUrl60 ?? null,
        backdropUrl: null,
        globalRating: undefined,
        globalRatingText: "iTunes",
        genres: t.primaryGenreName ? [t.primaryGenreName] : [],
        collectionId: t.collectionId != null ? String(t.collectionId) : undefined,
        collectionName: t.collectionName ?? undefined,
    };
}

export async function itunesDiscoverByIds(ids: string[]) {
    const out: any[] = [];
    for (const id of ids.slice(0, 20)) {
        try {
            const d = await itunesLookupById(id);
            if (d) out.push(d);
        } catch {
            // ignore
        }
    }
    return out;
}

export async function itunesTrackMeta(id: string): Promise<{
    previewUrl?: string;
    artistName?: string;
    collectionName?: string;
    trackTimeMillis?: number;
    artworkUrl100?: string;
    trackViewUrl?: string;
    primaryGenreName?: string;
} | null> {
    const url = `https://itunes.apple.com/lookup?id=${encodeURIComponent(id)}`;
    const res = await axios.get(url);
    const t = (res.data?.results ?? [])[0];
    if (!t) return null;

    return {
        previewUrl: t.previewUrl,
        artistName: t.artistName,
        collectionName: t.collectionName,
        trackTimeMillis: t.trackTimeMillis,
        artworkUrl100: t.artworkUrl100 ?? t.artworkUrl60,
        trackViewUrl: t.trackViewUrl,
        primaryGenreName: t.primaryGenreName,
    };
}