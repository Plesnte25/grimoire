export type CollectionGroup<T> = {
  primary: T;
  stack: T[];
};

/**
 * Groups items sharing a `collectionId` (franchise/series/album) into one stack,
 * preserving each group's position at its first member's original index — so when
 * nothing is grouped (every item solo), output order is identical to the input.
 */
export function groupByCollection<T extends { collectionId?: string | null }>(
  items: T[]
): CollectionGroup<T>[] {
  const byCollection = new Map<string, T[]>();
  for (const item of items) {
    if (!item.collectionId) continue;
    const arr = byCollection.get(item.collectionId) ?? [];
    arr.push(item);
    byCollection.set(item.collectionId, arr);
  }

  const emitted = new Set<string>();
  const groups: CollectionGroup<T>[] = [];

  for (const item of items) {
    if (item.collectionId) {
      if (emitted.has(item.collectionId)) continue;
      emitted.add(item.collectionId);
      const stack = byCollection.get(item.collectionId)!;
      groups.push({ primary: stack[0], stack });
    } else {
      groups.push({ primary: item, stack: [item] });
    }
  }

  return groups;
}
