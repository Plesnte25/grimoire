export type ProviderSearchResult = {
    mediaType: string;
    provider: string;
    providerId: string;
    title: string;
    year?: number;
    description?: string;
    posterUrl?: string;
    backdropUrl?: string;
    genres?: string[];
    globalRating?: number;
    globalRatingText?: string;
};

export function bestEffortYear(input?: string | number | null): number | undefined {
    if (input == null) return undefined;
    if (typeof input === "number") return input;
    const m = String(input).match(/\b(19|20)\d{2}\b/);
    return m ? Number(m[0]) : undefined;
}
