/**
 * LRU-like cache with frequency-based eviction (functional factory).
 *
 * Replaces the former `Cache` class with a `createCache()` factory.
 * No `class`, no `this`, no `prototype`.
 */
import { SPLITTER, nextCounter } from "./common";
import type { CacheEntry, CacheApi, CacheOptions } from "./types";

/** Sort comparator: higher frequency first, more recent access first */
function sortCacheEntries<T>(a: CacheEntry<T>, b: CacheEntry<T>): number {
  return b.frequency - a.frequency || b.lastTimestamp - a.lastTimestamp;
}

/**
 * Create an LFU-style bounded cache.
 *
 * @param options - Cache configuration
 * @returns A cache API object with `get`, `set`, `del`, `has`, `clear`, `forEach`, `size`.
 *
 * @example
 * const cache = createCache({ maxSize: 20, bufferSize: 5 });
 * cache.set('user', { name: 'Alice' });
 * const user = cache.get('user');
 * cache.has('user'); // true
 * cache.del('user');
 */
export function createCache<T = unknown>(
  options: CacheOptions<T> = {},
): CacheApi<T> {
  /** Cache entries array */
  let entries: CacheEntry<T>[] = [];

  /** Fast lookup: prefixed key -> entry */
  const lookup = new Map<string, CacheEntry<T>>();

  const maxSize = options.maxSize ?? 20;
  const bufferSize = options.bufferSize ?? 5;
  const capacity = maxSize + bufferSize;
  const onRemove = options.onRemove;
  const comparator = options.sortComparator ?? sortCacheEntries;

  /** Prefix a key with SPLITTER for namespace isolation */
  function prefixKey(key: string): string {
    return SPLITTER + key;
  }

  function get(key: string): T | undefined {
    const prefixedKey = prefixKey(key);
    const entry = lookup.get(prefixedKey);
    if (!entry) return undefined;
    entry.frequency++;
    entry.lastTimestamp = nextCounter();
    return entry.value;
  }

  function forEach(callback: (value: T | undefined) => void): void {
    for (const entry of entries) {
      callback(entry.value);
    }
  }

  function set(key: string, value: T): void {
    const prefixedKey = prefixKey(key);
    const existing = lookup.get(prefixedKey);

    if (existing) {
      existing.value = value;
      existing.frequency++;
      existing.lastTimestamp = nextCounter();
      return;
    }

    if (entries.length >= capacity) {
      evictEntries();
    }

    const entry: CacheEntry<T> = {
      originalKey: key,
      value,
      frequency: 1,
      lastTimestamp: nextCounter(),
    };
    entries.push(entry);
    lookup.set(prefixedKey, entry);
  }

  function del(key: string): void {
    const prefixedKey = prefixKey(key);
    const entry = lookup.get(prefixedKey);
    if (!entry) return;

    lookup.delete(prefixedKey);
    const idx = entries.indexOf(entry);
    if (idx !== -1) entries.splice(idx, 1);

    if (onRemove) {
      onRemove(key);
    }
  }

  function has(key: string): boolean {
    return lookup.has(prefixKey(key));
  }

  function clear(): void {
    if (onRemove) {
      for (const entry of entries) {
        onRemove(entry.originalKey);
      }
    }
    entries = [];
    lookup.clear();
  }

  /**
   * Evict the `bufferSize` worst entries from the cache.
   *
   * Uses single-pass partial selection (O(n·k)) instead of sorting the entire
   * `entries` array (O(n log n)). For the typical `bufferSize = 5` this is
   * effectively a linear scan with at most 5 in-bucket comparisons per
   * iteration — and it avoids mutating the rest of `entries`.
   */
  function evictEntries(): void {
    if (bufferSize <= 0 || entries.length === 0) return;

    if (entries.length <= bufferSize) {
      // Fast path: evict everything.
      for (const e of entries) {
        lookup.delete(prefixKey(e.originalKey));
        if (onRemove) onRemove(e.originalKey);
      }
      entries = [];
      return;
    }

    // Maintain `worst` sorted so that worst[0] is the worst-of-worst and
    // worst[bufferSize-1] is the best-of-worst (the eviction "boundary").
    const worst: CacheEntry<T>[] = [];

    for (const entry of entries) {
      if (worst.length < bufferSize) {
        let i = worst.length;
        while (i > 0 && comparator(entry, worst[i - 1]) > 0) i--;
        worst.splice(i, 0, entry);
      } else if (comparator(entry, worst[bufferSize - 1]) > 0) {
        worst.pop(); // drop the best-of-worst
        let i = worst.length;
        while (i > 0 && comparator(entry, worst[i - 1]) > 0) i--;
        worst.splice(i, 0, entry);
      }
    }

    const evictSet = new Set(worst);
    for (const e of worst) {
      lookup.delete(prefixKey(e.originalKey));
      if (onRemove) onRemove(e.originalKey);
    }
    entries = entries.filter((e) => !evictSet.has(e));
  }

  function getSize(): number {
    return entries.length;
  }

  const api: CacheApi<T> = {
    get,
    set,
    del,
    has,
    clear,
    forEach,
    getSize,
  };
  return api;
}
