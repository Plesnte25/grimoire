/**
 * Bounds a promise to `ms`: resolves/rejects with it if it settles first,
 * otherwise rejects with a timeout error. Used so a single slow or
 * rate-limited provider (e.g. AniList's serialized request queue backing up
 * from background suggestion loads) can't make an interactive search/add
 * request hang for the frontend's full request timeout.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
        promise.then(
            (value) => { clearTimeout(timer); resolve(value); },
            (err) => { clearTimeout(timer); reject(err); }
        );
    });
}
