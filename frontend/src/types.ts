export type MediaType = "MOVIE" | "TV" | "ANIME" | "BOOK";
export type MediaStatus = "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "ON_HOLD" | "DROPPED";

export type ProviderSearchResult = {
    mediaType: MediaType;
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

export type MediaItem = {
    id: string;
    mediaType: MediaType;
    provider: string;
    providerId: string;
    title: string;
    year?: number | null;
    description?: string | null;
    posterUrl?: string | null;
    backdropUrl?: string | null;
    globalRating?: number | null;
    globalRatingText?: string | null;

    status: MediaStatus;
    yourRating?: number | null;
    yourNotes?: string | null;
    progressText?: string | null;
    progressValue?: number | null;

    genres?: string | null; // JSON string array from backend
    createdAt: string;
    updatedAt: string;

    // Franchise/series grouping ("card stack") — best-effort, provider-sourced.
    collectionId?: string | null;
    collectionName?: string | null;
    collectionSource?: string | null;

    // Phase 1 metadata (stored at add time / by the backfill).
    franchiseId?: string | null;
    franchiseRole?: "MAIN" | "MOVIE" | "OVA" | "ONA" | "SPECIAL" | null;
    franchiseOrder?: number | null;
    franchise?: { title: string; posterUrl?: string | null; bannerUrl?: string | null } | null;
    nativeTitle?: string | null;
    format?: string | null;
    countryOfOrigin?: string | null;
    originalLanguage?: string | null;
    region?: "TR" | "PK" | "KR" | "EU" | null;
    regionOverride?: string | null;
    creator?: string | null;
    seasons?: number | null;
    episodes?: number | null;
    duration?: number | null;
    pageCount?: number | null;
    airStatus?: string | null;
    nextAirSeason?: number | null;
    nextAirEpisode?: number | null;
    nextAirDate?: string | null;
    airedEpisodeCount?: number | null;
    announcedNext?: string | null;
    announcedNextDate?: string | null;
};

export type CustomList = {
    id: string;
    name: string;
    description?: string | null;
    coverColor?: string | null;
    items: { id: string; order: number; media: MediaItem }[];
};
