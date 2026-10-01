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
    nativeTitle?: string;
    countryOfOrigin?: string;
    originalLanguage?: string;
    isDub?: boolean;
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
    progressSeason?: number | null;
    progressEpisode?: number | null;
    progressTotalOverride?: number | null;
    completedSeasonCount?: number | null;
    lastAiredSeason?: number | null;
    lastAiredEpisode?: number | null;
    tags?: { tag: Tag }[];
    imdbRating?: number | null;
    imdbVotes?: number | null;
    rtCritics?: number | null;
    metascore?: number | null;
    malScore?: number | null;
    malVotes?: number | null;
    credits?: {
        role: "DIRECTOR" | "CREATOR" | "AUTHOR" | "CAST" | "STUDIO";
        character?: string | null;
        contributor: { id: string; name: string; kind: "PERSON" | "STUDIO"; imageUrl?: string | null };
    }[];
};

/** A provider entry shown on franchise / collection / person pages. */
export type CatalogEntry = {
    provider: "anilist" | "tmdb";
    providerId: string;
    mediaType: "ANIME" | "MOVIE" | "TV";
    title: string;
    format?: string | null;
    role?: string | null;
    year?: number | null;
    date?: string | null;
    status?: string | null;
    posterUrl?: string | null;
    libraryId?: string;
    yourStatus?: MediaStatus;
    yourRating?: number | null;
};

export type Tag = { id: string; name: string; kind: "TAG" | "MOOD"; color?: string | null; count?: number };

export type WatchMode = "SUB" | "DUB" | "ORIGINAL";

export type WatchLog = {
    id: string;
    mediaId: string;
    startedAt?: string | null;
    finishedAt?: string | null;
    rating?: number | null;
    review?: string | null;
    reviewHasSpoilers: boolean;
    isRewatch: boolean;
    watchedOn?: string | null;
    watchMode?: WatchMode | null;
    watchedWith?: string | null;
    createdAt: string;
};

export type DiaryLog = WatchLog & {
    media: Pick<MediaItem, "id" | "title" | "mediaType" | "posterUrl" | "year">;
};

export type Season = { season: number; name: string; episodes: number; airDate: string | null };

export type Tier = "S" | "A" | "B" | "C" | "D";

export type TierList = {
    id: string;
    name: string;
    description?: string | null;
    updatedAt: string;
    entries: { id: string; mediaId: string; tier: Tier; order: number; media: MediaItem }[];
};

export type CustomList = {
    id: string;
    name: string;
    description?: string | null;
    coverColor?: string | null;
    kind: "LIST" | "TOP10";
    mediaType?: MediaType | null;
    isRanked: boolean;
    contains?: boolean;
    items: { id: string; order: number; note?: string | null; mediaId: string; media: MediaItem }[];
};
