export type ProviderName = "tmdb" | "anilist" | "googlebooks";

type Stats = {
    calls: number;
    errors: number;
    totalLatencyMs: number;
    lastSuccessAt: number | null;
    lastErrorAt: number | null;
    lastError: string | null;
    recent: boolean[]; // true = success, last RECENT_WINDOW calls
};

const RECENT_WINDOW = 50;
const stats = new Map<ProviderName, Stats>();

function get(name: ProviderName): Stats {
    let s = stats.get(name);
    if (!s) {
        s = { calls: 0, errors: 0, totalLatencyMs: 0, lastSuccessAt: null, lastErrorAt: null, lastError: null, recent: [] };
        stats.set(name, s);
    }
    return s;
}

/** Runs a provider call, recording its latency and outcome. */
export async function trackProvider<T>(name: ProviderName, fn: () => Promise<T>): Promise<T> {
    const s = get(name);
    const start = Date.now();
    try {
        const result = await fn();
        s.calls++;
        s.totalLatencyMs += Date.now() - start;
        s.lastSuccessAt = Date.now();
        s.recent.push(true);
        return result;
    } catch (err: any) {
        s.calls++;
        s.errors++;
        s.totalLatencyMs += Date.now() - start;
        s.lastErrorAt = Date.now();
        s.lastError = String(err?.message ?? err).slice(0, 300);
        s.recent.push(false);
        throw err;
    } finally {
        if (s.recent.length > RECENT_WINDOW) s.recent.shift();
    }
}

const iso = (t: number | null) => (t ? new Date(t).toISOString() : null);

export function providerHealthSnapshot() {
    const names: ProviderName[] = ["tmdb", "anilist", "googlebooks"];
    return Object.fromEntries(
        names.map((name) => {
            const s = get(name);
            const failed = s.recent.filter((ok) => !ok).length;
            return [
                name,
                {
                    calls: s.calls,
                    errors: s.errors,
                    avgLatencyMs: s.calls ? Math.round(s.totalLatencyMs / s.calls) : null,
                    recentErrorRate: s.recent.length ? Number((failed / s.recent.length).toFixed(3)) : null,
                    lastSuccessAt: iso(s.lastSuccessAt),
                    lastErrorAt: iso(s.lastErrorAt),
                    lastError: s.lastError,
                },
            ];
        })
    );
}
