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
    isAdult?: boolean;
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
    isAdult?: boolean | null;

    status: MediaStatus;
    yourRating?: number | null;
    yourRatingAt?: string | null;
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
    tmdbId?: string | null;
    tmdbMediaType?: "MOVIE" | "TV" | null;
    anilistPopularity?: number | null;

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
    releaseDate?: string | null;
    digitalReleaseDate?: string | null;
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
    reminder?: { pinned: boolean; untilAt: string | null } | null;
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
    airedEpisodeCount?: number | null;
    progressValue?: number | null;
    nextAirEpisode?: number | null;
    nextAirDate?: string | null;
    announcedNext?: string | null;
    announcedNextDate?: string | null;
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
    fromEpisode?: number | null;
    toEpisode?: number | null;
    label?: string | null;
    createdAt: string;
};

export type AccountPreferences = {
    showAdultContent: boolean;
    spoilerShield: boolean;
    watchCountry: string | null;
};

export type DiaryLog = WatchLog & {
    media: Pick<MediaItem, "id" | "title" | "mediaType" | "posterUrl" | "year">;
};

export type Season = { season: number; name: string; episodes: number; airDate: string | null };

export type Episode = {
    id: string;
    seasonNumber: number;
    episodeNumber: number;
    name: string;
    overview?: string | null;
    airDate?: string | null;
    runtime?: number | null;
    stillUrl?: string | null;
};

export type TrustedDevice = {
    id: string;
    label?: string | null;
    userAgent?: string | null;
    createdAt: string;
    lastSeenAt: string;
    isCurrent: boolean;
};

export type HomeTitle = MediaItem & {
    newEpisodeCount: number;
    reminder: { pinned: boolean; untilAt: string | null } | null;
};

export type AnnualGoalProgress = {
    id: string;
    year: number;
    scope: "ALL" | MediaType;
    target: number;
    completed: number;
};

export type HomeSnapshot = {
    readyToWatch: HomeTitle[];
    comingSoon: HomeTitle[];
    continueWatching: HomeTitle[];
    rewatch: HomeTitle[];
    goals: AnnualGoalProgress[];
    top10: CustomList[];
};

export type WatchProvider = {
    id: number;
    name: string;
    logoUrl: string | null;
    availability: "flatrate" | "rent" | "buy";
};

export type Trailer = { id: string; name: string; type: string; url: string };

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
