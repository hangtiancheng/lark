import type { SearchResult, CacheEntry } from "@/types";

const maxCacheSize = 40;
const searchCache = new Map<string, CacheEntry>();

export function getCachedSearch(key: string, cacheTtlMs: number) {
  const cached = searchCache.get(key);
  if (!cached) return null;

  if (Date.now() - cached.updatedAt > cacheTtlMs) {
    searchCache.delete(key);
    return null;
  }

  return cached;
}

export function setCachedSearch(
  key: string,
  items: SearchResult[],
  total: number,
  cacheTtlMs: number,
) {
  searchCache.set(key, {
    items,
    total,
    updatedAt: Date.now(),
  });

  cleanupSearchCache(cacheTtlMs);
}

export function cleanupSearchCache(cacheTtlMs: number) {
  const now = Date.now();

  for (const [key, entry] of searchCache) {
    if (now - entry.updatedAt > cacheTtlMs) searchCache.delete(key);
  }

  while (searchCache.size > maxCacheSize) {
    const oldestKey = searchCache.keys().next();
    if (oldestKey.done) break;
    searchCache.delete(oldestKey.value);
  }
}
