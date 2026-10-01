export type CollectionGroup<T> = {
  primary: T;
  stack: T[];
  name?: string | null;
};

type Groupable = {
  collectionId?: string | null;
  collectionName?: string | null;
  franchiseId?: string | null;
  franchiseOrder?: number | null;
  franchise?: { title: string } | null;
};

/** Anime groups by franchise (its original series); movies by TMDB collection. */
function groupKey(item: Groupable): string | null {
  if (item.franchiseId) return `franchise:${item.franchiseId}`;
  if (item.collectionId) return `collection:${item.collectionId}`;
  return null;
}

/**
 * Groups items sharing a franchise/collection into one stack, preserving each
 * group's position at its first member's original index — so when nothing is
 * grouped (every item solo), output order is identical to the input. Inside a
 * franchise, entries are in airing order.
 */
export function groupByCollection<T extends Groupable>(items: T[]): CollectionGroup<T>[] {
  const byKey = new Map<string, T[]>();
  for (const item of items) {
    const key = groupKey(item);
    if (!key) continue;
    const arr = byKey.get(key) ?? [];
    arr.push(item);
    byKey.set(key, arr);
  }

  const emitted = new Set<string>();
  const groups: CollectionGroup<T>[] = [];

  for (const item of items) {
    const key = groupKey(item);
    if (key) {
      if (emitted.has(key)) continue;
      emitted.add(key);
      const stack = byKey.get(key)!;
      if (item.franchiseId) {
        stack.sort((a, b) => (a.franchiseOrder ?? Infinity) - (b.franchiseOrder ?? Infinity));
      }
      groups.push({
        primary: stack[0],
        stack,
        name: item.franchise?.title ?? item.collectionName ?? null,
      });
    } else {
      groups.push({ primary: item, stack: [item] });
    }
  }

  return groups;
}
