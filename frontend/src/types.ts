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
    rewatchCount?: number;
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
    franchiseOverride?: boolean;
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
    progressSeason?: number | null;
    progressEpisode?: number | null;
    nextAirEpisode?: number | null;
    nextAirDate?: string | null;
    announcedNext?: string | null;
    announcedNextDate?: string | null;
};

export type Tag = { id: string; name: string; kind: "TAG" | "MOOD"; color?: string | null; count?: number };

export type AccountPreferences = {
    showAdultContent: boolean;
    spoilerShield: boolean;
    watchCountry: string | null;
    defaultMediaStatus: Exclude<MediaStatus, "ON_HOLD">;
};

export type SuggestionReason =
    | { type: "SEED_RECOMMENDATION"; seed: { id: string; title: string; mediaType: MediaType } }
    | { type: "TRENDING_IN_YOUR_TASTE"; genres: string[] };

export type SuggestionItem = ProviderSearchResult & {
    reason: SuggestionReason;
};

export type SuggestionGroup = {
    becauseYouLike: SuggestionItem[];
    trendingInYourTaste: SuggestionItem[];
    quickPicks: SuggestionItem[];
    topGenres: string[];
};

export type SuggestionsResponse = {
    seed: number;
    scope: string;
    byType: Record<MediaType, SuggestionGroup>;
};

export type MediaStats = {
    libraryTotals: {
        totalTitles: number;
        byMediaType: { mediaType: MediaType; count: number }[];
        byStatus: { status: MediaStatus; count: number }[];
        totalEpisodesTracked: number;
        totalEpisodesAvailable: number;
        totalPagesTracked: number;
        totalPagesAvailable: number;
    };
    ratings: {
        distribution: { rating: number; count: number }[];
        averagePersonalRating: number | null;
        averageProviderRating: number | null;
        highestRatedByType: { mediaType: MediaType; item: { id: string; title: string; posterUrl?: string | null; yourRating: number | null; globalRating: number | null } | null }[];
    };
    tasteProfile: {
        topGenres: { genre: string; count: number }[];
        countries: { country: string; count: number }[];
        releaseDecades: { decade: string; count: number }[];
        topContributors: { role: string; contributorId: string; name: string; kind: string; count: number }[];
    };
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
};

export type HomeSnapshot = {
    continueWatching: HomeTitle[];
    newEpisodes: HomeTitle[];
    recentlyAdded: HomeTitle[];
};

export type WatchProvider = {
    id: number;
    name: string;
    logoUrl: string | null;
    availability: "flatrate" | "rent" | "buy";
};

export type Trailer = { id: string; name: string; type: string; url: string };

export type SharedList = {
    name: string;
    description: string | null;
    coverColor: string | null;
    kind: "LIST" | "TOP10";
    mediaType: MediaType | null;
    isRanked: boolean;
    items: {
        order: number;
        media: Pick<MediaItem, "title" | "mediaType" | "year" | "posterUrl" | "globalRating">;
    }[];
};

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
