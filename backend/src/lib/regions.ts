// Regional categories (KNOWN_ISSUES #37). Shows and films from these countries
// get their own Home category; everything else stays in TV / Movies. Adding a
// region later is one entry here (plus its label in the frontend).

export type Region = "TR" | "PK" | "KR" | "EU";

// English-language UK/IE stay in the general TV/Movies categories.
const EUROPE = new Set([
    "AD", "AL", "AT", "BA", "BE", "BG", "CH", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GR", "HR",
    "HU", "IS", "IT", "LI", "LT", "LU", "LV", "MC", "MD", "ME", "MK", "MT", "NL", "NO", "PL", "PT", "RO",
    "RS", "SE", "SI", "SK", "SM", "UA", "XK",
]);

export function regionForCountry(country?: string | null): Region | null {
    const c = (country ?? "").toUpperCase();
    if (c === "TR" || c === "PK" || c === "KR") return c;
    if (EUROPE.has(c)) return "EU";
    return null;
}

/** Regional categories cover TV shows and films only (anime/books have their own). */
export function regionForItem(mediaType: string, country?: string | null): Region | null {
    if (mediaType !== "TV" && mediaType !== "MOVIE") return null;
    return regionForCountry(country);
}
