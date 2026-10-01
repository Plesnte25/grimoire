import type { MediaItem, MediaType } from "../types";

// Regional categories (KNOWN_ISSUES #37). Mirrors backend/src/lib/regions.ts.
export type Region = "TR" | "PK" | "KR" | "EU";
export const REGIONS: Region[] = ["TR", "PK", "KR", "EU"];

export const REGION_LABEL: Record<Region, string> = {
  TR: "Turkish Dizi",
  PK: "Pakistani Dramas",
  KR: "K-Drama",
  EU: "European",
};

/** A Home / Library category: a media type or a regional category. */
export type CategoryKey = MediaType | Region;

export function isRegion(k: string | undefined | null): k is Region {
  return !!k && (REGIONS as string[]).includes(k);
}

/** Your "Move to…" choice, else the region from the item's country. */
export function effectiveRegion(item: Pick<MediaItem, "region" | "regionOverride">): Region | null {
  if (item.regionOverride === "NONE") return null;
  return ((item.regionOverride ?? item.region) as Region | null) ?? null;
}

/** "TR" → 🇹🇷 (regional-indicator letters). */
export function countryFlag(code?: string | null): string {
  if (!code || !/^[A-Za-z]{2}$/.test(code)) return "";
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

/** "TR" → "Turkey" in the viewer's language. */
export function countryName(code?: string | null): string {
  if (!code) return "";
  try {
    return new Intl.DisplayNames(undefined, { type: "region" }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}
