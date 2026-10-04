import axios from "axios";
import type {
    AccountPreferences, MediaItem, ProviderSearchResult, MediaType, CustomList, Season, Tag, TierList, Tier,
    CatalogEntry, Episode, TrustedDevice, HomeSnapshot, WatchProvider, Trailer, SharedList, MediaStats, SuggestionsResponse,
} from "../types";

const API_BASE =
    (import.meta.env.VITE_API_BASE && String(import.meta.env.VITE_API_BASE).trim()) || "";

export const api = axios.create({
    baseURL: API_BASE,
    timeout: 20_000,
    withCredentials: true,
});

// --- Auth ---

export type AuthStatus = {
    bootstrap: boolean;
    deviceTrusted: boolean;
    unlocked: boolean;
};

export async function authStatus(): Promise<AuthStatus> {
    const res = await api.get("/api/auth/status");
    return res.data;
}

export async function bootstrapAccount(email: string, pin: string) {
    await api.post("/api/auth/bootstrap", { email, pin });
}

export async function requestOtp(email: string) {
    await api.post("/api/auth/otp/request", { email });
}

export async function verifyOtp(code: string) {
    await api.post("/api/auth/otp/verify", { code });
}

export async function unlockWithPin(pin: string) {
    await api.post("/api/auth/unlock", { pin });
}

export async function lock() {
    await api.post("/api/auth/lock");
}

export async function refreshSession() {
    await api.post("/api/auth/activity");
}

export async function setAccountPin(currentPin: string, newPin: string, revokeOtherDevices = false) {
    await api.post("/api/auth/pin", { currentPin, newPin, revokeOtherDevices });
}

export async function fetchTrustedDevices(): Promise<TrustedDevice[]> {
    const res = await api.get("/api/auth/devices");
    return res.data.devices;
}

export async function revokeTrustedDevice(id: string): Promise<{ isCurrent: boolean }> {
    const res = await api.delete(`/api/auth/devices/${encodeURIComponent(id)}`);
    return res.data;
}

export async function fetchHomeSnapshot(): Promise<HomeSnapshot> {
    const res = await api.get("/api/home");
    return res.data;
}

export async function fetchAccountPreferences(): Promise<AccountPreferences> {
    const res = await api.get("/api/auth/preferences");
    return res.data.preferences;
}

export async function updateAccountPreferences(
    patch: Partial<AccountPreferences>
): Promise<AccountPreferences> {
    const res = await api.patch("/api/auth/preferences", patch);
    return res.data.preferences;
}

// --- Providers ---

export async function providerSearch(
    q: string,
    mediaType?: MediaType,
    region?: "TR" | "PK" | "KR" | "EU"
): Promise<ProviderSearchResult[]> {
    const res = await api.get("/api/providers/search", {
        params: { q, mediaType, region },
    });
    return res.data?.results ?? [];
}

export async function providerDetails(
    provider: string,
    providerId: string,
    mediaType: MediaType
) {
    const res = await api.get("/api/providers/details", {
        params: { provider, providerId, mediaType },
    });
    return res.data?.details ?? null;
}

// --- Library ---

export async function addToLibrary(
    payload: Omit<ProviderSearchResult, "genres"> &
        Partial<Pick<MediaItem, "status" | "yourRating" | "yourNotes" | "progressText" | "progressValue" | "episodes" | "countryOfOrigin">> &
        { regionOverride?: string | null; genres?: string | string[] }
): Promise<MediaItem> {
    const res = await api.post("/api/library", payload);
    return res.data.item;
}

export async function updateLibrary(id: string, patch: Record<string, any>): Promise<MediaItem> {
    const res = await api.patch(`/api/library/${id}`, patch);
    return res.data.item;
}

/** A media type's library, or a regional category's shows and films. */
export async function fetchLibrary(category?: MediaType | "TR" | "PK" | "KR" | "EU"): Promise<MediaItem[]> {
    const region = category && ["TR", "PK", "KR", "EU"].includes(category) ? category : undefined;
    const res = await api.get("/api/library", { params: region ? { region } : { mediaType: category } });
    return res.data?.items ?? [];
}

export async function fetchItem(id: string): Promise<MediaItem> {
    const res = await api.get(`/api/library/${id}`);
    return res.data.item;
}

export type ItemPatch = Partial<
    Pick<
        MediaItem,
        | "status"
        | "yourRating"
        | "yourNotes"
        | "progressText"
        | "progressValue"
        | "progressSeason"
        | "progressEpisode"
        | "progressTotalOverride"
        | "regionOverride"
        | "title"
        | "year"
        | "countryOfOrigin"
        | "episodes"
        | "posterUrl"
    >
>;

export async function updateItem(id: string, patch: ItemPatch): Promise<MediaItem> {
    const res = await api.patch(`/api/library/${id}`, patch);
    return res.data.item;
}

export async function changeRewatchCount(id: string, delta: -1 | 0 | 1 = 1): Promise<MediaItem> {
    const res = await api.post(`/api/library/${encodeURIComponent(id)}/rewatch`, { delta });
    return res.data.item;
}

export async function setManualFranchise(id: string, franchiseId: string | null): Promise<MediaItem> {
    const res = await api.post(`/api/library/${id}/franchise`, { franchiseId });
    return res.data.item;
}

export async function linkAnimeTmdbRecord(
    id: string,
    tmdbId: string,
    tmdbMediaType: "MOVIE" | "TV"
): Promise<MediaItem> {
    const res = await api.post(`/api/library/${id}/tmdb-link`, { tmdbId, tmdbMediaType });
    return res.data.item;
}

export async function deleteLibraryItem(id: string) {
    const res = await api.delete(`/api/library/${id}`);
    return res.data;
}

// --- Lists ---

export async function fetchLists(): Promise<CustomList[]> {
    const res = await api.get("/api/lists");
    return res.data?.lists ?? [];
}

export async function createList(payload: {
    name: string;
    description?: string;
    coverColor?: string;
}): Promise<CustomList> {
    const res = await api.post("/api/lists", payload);
    return res.data.list;
}

export async function fetchList(id: string): Promise<CustomList> {
    const res = await api.get(`/api/lists/${id}`);
    return res.data.list;
}

export async function fetchListsContaining(mediaId: string): Promise<CustomList[]> {
    const res = await api.get("/api/lists", { params: { containing: mediaId } });
    return res.data?.lists ?? [];
}

export async function fetchTop10(mediaType: MediaType): Promise<CustomList> {
    const res = await api.get(`/api/lists/top10/${mediaType}`);
    return res.data.list;
}

export async function addItemToList(listId: string, mediaId: string) {
    const res = await api.post(`/api/lists/${listId}/items`, { mediaId });
    return res.data.item;
}

export async function updateList(
    id: string,
    patch: { name?: string; description?: string | null; isRanked?: boolean }
): Promise<CustomList> {
    const res = await api.patch(`/api/lists/${id}`, patch);
    return res.data.list;
}

export async function deleteList(id: string) {
    await api.delete(`/api/lists/${id}`);
}

export async function removeListItem(listId: string, itemId: string) {
    await api.delete(`/api/lists/${listId}/items/${itemId}`);
}

export async function setListItemNote(listId: string, itemId: string, note: string | null) {
    await api.patch(`/api/lists/${listId}/items/${itemId}`, { note });
}

export async function reorderList(listId: string, itemIds: string[]): Promise<CustomList> {
    const res = await api.put(`/api/lists/${listId}/order`, { itemIds });
    return res.data.list;
}

export async function fetchSeasons(mediaId: string): Promise<Season[]> {
    const res = await api.get(`/api/library/${mediaId}/seasons`);
    return res.data.seasons;
}

export async function fetchEpisodes(mediaId: string, season: number): Promise<{ episodes: Episode[]; available: boolean }> {
    const res = await api.get(`/api/library/${mediaId}/seasons/${season}/episodes`);
    return res.data;
}

export async function fetchWatchProviders(mediaId: string, country: string): Promise<{
    available: boolean;
    providers: WatchProvider[];
    link: string | null;
}> {
    const res = await api.get(`/api/providers/media/${encodeURIComponent(mediaId)}/watch`, { params: { country } });
    return res.data;
}

export async function fetchTrailers(mediaId: string): Promise<{ available: boolean; trailers: Trailer[] }> {
    const res = await api.get(`/api/providers/media/${encodeURIComponent(mediaId)}/trailers`);
    return res.data;
}

export async function createListShare(listId: string): Promise<string> {
    const res = await api.post(`/api/lists/${encodeURIComponent(listId)}/share`);
    return res.data.token;
}

export async function revokeListShare(listId: string) {
    await api.delete(`/api/lists/${encodeURIComponent(listId)}/share`);
}

export async function fetchSharedList(token: string): Promise<SharedList> {
    const res = await api.get(`/api/public/lists/${encodeURIComponent(token)}`);
    return res.data.list;
}

export async function fetchBackup(): Promise<Blob> {
    const res = await api.get("/api/backup/export", { responseType: "blob" });
    return res.data;
}

export async function importBackup(data: unknown): Promise<{ ok: true; importedItems: number }> {
    const res = await api.post("/api/backup/import", data, { timeout: 60_000 });
    return res.data;
}

// --- Tags ---

export async function fetchTags(): Promise<Tag[]> {
    const res = await api.get("/api/tags");
    return res.data.tags;
}

export async function setItemTags(mediaId: string, names: string[], kind: Tag["kind"]): Promise<Tag[]> {
    const res = await api.put(`/api/library/${mediaId}/tags`, { names, kind });
    return res.data.tags;
}

// --- Tier lists ---

export async function fetchTierLists(): Promise<TierList[]> {
    const res = await api.get("/api/tier-lists");
    return res.data.tierLists;
}

export async function fetchTierList(id: string): Promise<TierList> {
    const res = await api.get(`/api/tier-lists/${id}`);
    return res.data.tierList;
}

export async function createTierList(name: string): Promise<TierList> {
    const res = await api.post("/api/tier-lists", { name });
    return res.data.tierList;
}

export async function updateTierList(id: string, patch: { name?: string }): Promise<TierList> {
    const res = await api.patch(`/api/tier-lists/${id}`, patch);
    return res.data.tierList;
}

export async function deleteTierList(id: string) {
    await api.delete(`/api/tier-lists/${id}`);
}

export async function saveTierEntries(
    id: string,
    entries: { mediaId: string; tier: Tier }[]
): Promise<TierList> {
    const res = await api.put(`/api/tier-lists/${id}/entries`, { entries });
    return res.data.tierList;
}

// --- Suggestions ---

export async function fetchSuggestions(
    mediaType: MediaType,
    scope?: string,
    refresh?: number
): Promise<SuggestionsResponse> {
    const res = await api.get("/api/suggestions", {
        params: { mediaType, scope, refresh },
        timeout: 20_000,
    });
    return res.data;
}

export async function dismissSuggestion(
    provider: string,
    mediaId: string,
    mediaType: MediaType
): Promise<void> {
    await api.post("/api/suggestions/dismiss", { provider, mediaId, mediaType });
}

export async function fetchMediaStats(): Promise<MediaStats> {
    const res = await api.get("/api/stats");
    return res.data;
}



// --- Catalogue: franchise / collection / person pages ---

export async function fetchFranchise(id: string): Promise<{
    franchise: { id: string; title: string; nativeTitle?: string | null; posterUrl?: string | null; bannerUrl?: string | null; countryOfOrigin?: string | null; status?: string | null };
    entries: CatalogEntry[];
}> {
    const res = await api.get(`/api/franchises/${id}`, { timeout: 120_000 });
    return res.data;
}

export async function fetchCollection(id: string): Promise<{
    id: string;
    name: string;
    overview?: string | null;
    backdropUrl?: string | null;
    parts: CatalogEntry[];
}> {
    const res = await api.get(`/api/collections/${id}`);
    return res.data;
}

export async function fetchContributor(id: string): Promise<{
    contributor: { id: string; name: string; kind: "PERSON" | "STUDIO"; imageUrl?: string | null };
    bio?: string | null;
    yours: (Pick<MediaItem, "id" | "title" | "mediaType" | "year" | "posterUrl" | "status" | "yourRating"> & { role: string; character?: string | null })[];
    otherWork: CatalogEntry[];
}> {
    const res = await api.get(`/api/contributors/${encodeURIComponent(id)}`);
    return res.data;
}

/** Adds a catalogue entry to the library (the server fills in the details). */
export async function addCatalogEntry(e: CatalogEntry): Promise<MediaItem> {
    return addToLibrary({
        provider: e.provider,
        providerId: e.providerId,
        mediaType: e.mediaType,
        title: e.title,
        year: e.year ?? undefined,
        posterUrl: e.posterUrl ?? undefined,
    } as any);
}
