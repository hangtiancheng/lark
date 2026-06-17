/**
 * LRU-like cache with frequency-based eviction.
 */
import { SPLITTER } from "./common";
import { nextCounter } from "./common";
import type { CacheEntry, CacheInterface, CacheOptions } from "./types";

/** Sort comparator: higher frequency first, more recent access first */
function sortCacheEntries<T>(a: CacheEntry<T>, b: CacheEntry<T>): number {
  return b.frequency - a.frequency || b.lastTimestamp - a.lastTimestamp;
}

/**
 * Cache class with LFU-style eviction.
 * Keys are prefixed with SPLITTER for namespace isolation.
 *
 * @example
 * const cache = new Cache({ maxSize: 20, bufferSize: 5 });
 * cache.set('user', { name: 'Alice' });
 * const user = cache.get('user');
 * cache.has('user'); // true
 * cache.del('user');
 */
export class Cache<T = unknown> implements CacheInterface<T> {
  /** Cache entries array */
  private entries: CacheEntry<T>[] = [];

  /** Fast lookup: prefixed key -> entry */
  private lookup = new Map<string, CacheEntry<T>>();

  /** Buffer size for eviction */
  private readonly bufferSize: number;

  /** Maximum cache size */
  private readonly maxSize: number;

  /** Total capacity (maxSize + bufferSize) */
  private readonly capacity: number;

  /** Callback when entry is removed */
  private readonly onRemove?: ((key: string) => void) | undefined;

  /** Sort comparator */
  private readonly comparator: (a: CacheEntry<T>, b: CacheEntry<T>) => number;

  constructor(options: CacheOptions<T> = {}) {
    this.maxSize = options.maxSize ?? 20;
    this.bufferSize = options.bufferSize ?? 5;
    this.capacity = this.maxSize + this.bufferSize;
    this.onRemove = options.onRemove;
    this.comparator = options.sortComparator ?? sortCacheEntries;
  }

  /** Prefix a key with SPLITTER for namespace isolation */
  private prefixKey(key: string): string {
    return SPLITTER + key;
  }

  /**
   * Get a cached value by key.
   * Updates frequency and timestamp for cache sorting.
   */
  get(key: string): T | undefined {
    const prefixedKey = this.prefixKey(key);
    const entry = this.lookup.get(prefixedKey);
    if (!entry) return undefined;
    entry.frequency++;
    entry.lastTimestamp = nextCounter();
    return entry.value;
  }

  /**
   * Iterate all cached values.
   */
  forEach(callback: (value: T | undefined) => void): void {
    for (const entry of this.entries) {
      callback(entry.value);
    }
  }

  /**
   * Set or update a cached value.
   * If key already exists, updates value and increments frequency.
   * If cache exceeds capacity, triggers eviction.
   */
  set(key: string, value: T): void {
    const prefixedKey = this.prefixKey(key);
    const existing = this.lookup.get(prefixedKey);

    if (existing) {
      // Update existing entry (fixes Bug: old code didn't update value)
      existing.value = value;
      existing.frequency++;
      existing.lastTimestamp = nextCounter();
      return;
    }

    // Evict if at capacity
    if (this.entries.length >= this.capacity) {
      this.evictEntries();
    }

    const entry: CacheEntry<T> = {
      originalKey: key,
      value,
      frequency: 1,
      lastTimestamp: nextCounter(),
    };
    this.entries.push(entry);
    this.lookup.set(prefixedKey, entry);
  }

  /**
   * Delete a cached entry. Removes it immediately from both the lookup map
   * and the entries array so the GC can reclaim the value without waiting
   * for the next eviction sweep.
   */
  del(key: string): void {
    const prefixedKey = this.prefixKey(key);
    const entry = this.lookup.get(prefixedKey);
    if (!entry) return;

    this.lookup.delete(prefixedKey);
    const idx = this.entries.indexOf(entry);
    if (idx !== -1) this.entries.splice(idx, 1);

    if (this.onRemove) {
      this.onRemove(key);
    }
  }

  /**
   * Check if a key exists in cache.
   */
  has(key: string): boolean {
    return this.lookup.has(this.prefixKey(key));
  }

  /** Get current cache size */
  get size(): number {
    return this.entries.length;
  }

  /** Clear all entries */
  clear(): void {
    if (this.onRemove) {
      for (const entry of this.entries) {
        this.onRemove(entry.originalKey);
      }
    }
    this.entries = [];
    this.lookup.clear();
  }

  /**
   * Evict the `bufferSize` worst entries from the cache.
   *
   * Uses single-pass partial selection (O(n·k)) instead of sorting the entire
   * `entries` array (O(n log n)). For the typical `bufferSize = 5` this is
   * effectively a linear scan with at most 5 in-bucket comparisons per
   * iteration — and it avoids mutating the rest of `entries`.
   */
  private evictEntries(): void {
    const entries = this.entries;
    const k = this.bufferSize;
    if (k <= 0 || entries.length === 0) return;

    if (entries.length <= k) {
      // Fast path: evict everything.
      for (const e of entries) {
        this.lookup.delete(this.prefixKey(e.originalKey));
        if (this.onRemove) this.onRemove(e.originalKey);
      }
      this.entries = [];
      return;
    }

    // Maintain `worst` sorted so that worst[0] is the worst-of-worst and
    // worst[k-1] is the best-of-worst (the eviction "boundary").
    // `cmp(a, b) > 0` means `a` should sort after `b` — i.e. `a` is worse.
    const cmp = this.comparator;
    const worst: CacheEntry<T>[] = [];

    for (const entry of entries) {
      if (worst.length < k) {
        let i = worst.length;
        while (i > 0 && cmp(entry, worst[i - 1]) > 0) i--;
        worst.splice(i, 0, entry);
      } else if (cmp(entry, worst[k - 1]) > 0) {
        worst.pop(); // drop the best-of-worst
        let i = worst.length;
        while (i > 0 && cmp(entry, worst[i - 1]) > 0) i--;
        worst.splice(i, 0, entry);
      }
    }

    const evictSet = new Set(worst);
    for (const e of worst) {
      this.lookup.delete(this.prefixKey(e.originalKey));
      if (this.onRemove) this.onRemove(e.originalKey);
    }
    this.entries = entries.filter((e) => !evictSet.has(e));
  }
}
