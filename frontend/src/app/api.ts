import axios from "axios";
import type { MediaItem, ProviderSearchResult, MediaType, CustomList } from "../types";

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

export async function setAccountPin(currentPin: string, newPin: string) {
    await api.post("/api/auth/pin", { currentPin, newPin });
}

// --- Providers ---

export async function providerSearch(
    q: string,
    mediaType?: MediaType
): Promise<ProviderSearchResult[]> {
    const res = await api.get("/api/providers/search", {
        params: { q, mediaType },
    });
    return res.data?.results ?? [];
}

export type TrackMeta = {
    previewUrl?: string;
    artistName?: string;
    collectionName?: string;
    trackTimeMillis?: number;
    artworkUrl100?: string;
    trackViewUrl?: string;
    primaryGenreName?: string;
} | null;

export async function fetchTrackMeta(providerId: string): Promise<TrackMeta> {
    const res = await api.get("/api/providers/track-meta", {
        params: { providerId },
    });
    return res.data?.meta ?? null;
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
    payload: ProviderSearchResult &
        Partial<
            Pick<
                MediaItem,
                "status" | "yourRating" | "yourNotes" | "progressText" | "progressValue"
            >
        >
): Promise<MediaItem> {
    const res = await api.post("/api/library", payload);
    return res.data.item;
}

export async function updateLibrary(id: string, patch: Record<string, any>): Promise<MediaItem> {
    const res = await api.patch(`/api/library/${id}`, patch);
    return res.data.item;
}

export async function fetchLibrary(mediaType?: MediaType): Promise<MediaItem[]> {
    const res = await api.get("/api/library", { params: { mediaType } });
    return res.data?.items ?? [];
}

export async function fetchItem(id: string): Promise<MediaItem> {
    const res = await api.get(`/api/library/${id}`);
    return res.data.item;
}

export async function updateItem(
    id: string,
    patch: Partial<
        Pick<MediaItem, "status" | "yourRating" | "yourNotes" | "progressText" | "progressValue">
    >
): Promise<MediaItem> {
    const res = await api.patch(`/api/library/${id}`, patch);
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

export async function addItemToList(listId: string, mediaId: string) {
    const res = await api.post(`/api/lists/${listId}/items`, { mediaId });
    return res.data.item;
}

// --- Suggestions ---

export async function fetchSuggestions(
    mediaType: MediaType,
    scope?: string,
    refresh?: number
) {
    const res = await api.get("/api/suggestions", {
        params: { mediaType, scope, refresh },
        timeout: 20_000,
    });
    return res.data;
}



