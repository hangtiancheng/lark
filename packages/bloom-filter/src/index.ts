import { xxh32 } from "@node-rs/xxhash";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BloomFilterConfig {
  /** Size of the bit array in bits. */
  readonly m: number;
  /** Number of hash functions. */
  readonly k: number;
  /** Hash seed. */
  readonly seed: number;
  /** The `n` used at construction time. */
  readonly expectedItems: number;
  /** The `p` used at construction time. */
  readonly falsePositiveRate: number;
}

export interface BloomFilterSnapshot {
  /** Configuration used to create the filter. */
  config: BloomFilterConfig;
  /** Base-64 encoded bit array. */
  data: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Optimal bit-array size:
 *   m = ceil( -n · ln(p) / (ln2)² )
 */
function optimalM(n: number, p: number): number {
  return Math.ceil((-n * Math.log(p)) / (Math.LN2 * Math.LN2));
}

/**
 * Optimal number of hash functions:
 *   k = round( (m / n) · ln2 )
 */
function optimalK(m: number, n: number): number {
  return Math.max(1, Math.round((m / n) * Math.LN2));
}

/** Pop-count of a byte (Brian Kernighan). */
function popcnt8(v: number): number {
  let count = 0;
  while (v) {
    v &= v - 1;
    count++;
  }
  return count;
}

// ---------------------------------------------------------------------------
// BloomFilter
// ---------------------------------------------------------------------------

/**
 * A space-efficient probabilistic data structure for set-membership testing.
 *
 * - **No false negatives**: `has()` returning `false` guarantees the item was
 *   never added.
 * - **Possible false positives**: `has()` returning `true` means the item is
 *   *probably* in the set, subject to the configured false-positive rate.
 *
 * Uses enhanced double-hashing (`h1 + i·h2`) with xxHash32 for fast,
 * well-distributed bit indices.
 */
export class BloomFilter {
  // --- Immutable configuration ---
  public readonly m: number;
  public readonly k: number;
  private readonly seed: number;
  private readonly expectedItems: number;
  private readonly falsePositiveRate: number;

  // --- Mutable state ---
  private bitArray: Uint8Array;
  private insertedCount: number = 0;

  // -----------------------------------------------------------------------
  // Construction
  // -----------------------------------------------------------------------

  /**
   * @param expectedItems      Expected number of items to insert (`n`). Must be > 0.
   * @param falsePositiveRate  Desired false-positive probability (`p`), in (0, 1).
   * @param seed               Optional hash seed (default `0`).
   */
  constructor(
    expectedItems: number,
    falsePositiveRate: number,
    seed: number = 0,
  ) {
    if (!Number.isFinite(expectedItems) || expectedItems <= 0) {
      throw new RangeError(
        `expectedItems must be a positive number, got ${expectedItems}`,
      );
    }
    if (
      !Number.isFinite(falsePositiveRate) ||
      falsePositiveRate <= 0 ||
      falsePositiveRate >= 1
    ) {
      throw new RangeError(
        `falsePositiveRate must be in (0, 1), got ${falsePositiveRate}`,
      );
    }

    this.expectedItems = expectedItems;
    this.falsePositiveRate = falsePositiveRate;
    this.seed = seed;
    this.m = optimalM(expectedItems, falsePositiveRate);
    this.k = optimalK(this.m, expectedItems);
    this.bitArray = new Uint8Array(Math.ceil(this.m / 8));
  }

  // -----------------------------------------------------------------------
  // Core API
  // -----------------------------------------------------------------------

  /**
   * Add an item to the filter.
   *
   * @returns `this` for chaining.
   */
  public add(item: string | number | boolean): this {
    const hashes = this.hashIndices(String(item));
    for (let i = 0; i < hashes.length; i++) {
      const idx = hashes[i];
      this.bitArray[idx >>> 3] |= 1 << (idx & 7);
    }
    this.insertedCount++;
    return this;
  }

  /**
   * Test whether an item *might* be in the set.
   *
   * @returns `true` = possibly present; `false` = definitely absent.
   */
  public has(item: string | number | boolean): boolean {
    const hashes = this.hashIndices(String(item));
    for (let i = 0; i < hashes.length; i++) {
      const idx = hashes[i];
      if ((this.bitArray[idx >>> 3] & (1 << (idx & 7))) === 0) {
        return false;
      }
    }
    return true;
  }

  /**
   * Bulk-add multiple items.
   *
   * @returns `this` for chaining.
   */
  public addAll(items: Iterable<string | number | boolean>): this {
    for (const item of items) {
      this.add(item);
    }
    return this;
  }

  /**
   * Reset to empty state. Configuration (m, k, seed) is preserved.
   */
  public clear(): void {
    this.bitArray.fill(0);
    this.insertedCount = 0;
  }

  // -----------------------------------------------------------------------
  // Diagnostics
  // -----------------------------------------------------------------------

  /** Number of `add()` calls (not de-duplicated). */
  public get size(): number {
    return this.insertedCount;
  }

  /**
   * Ratio of bits set to 1 — the "saturation" of the filter.
   * A value approaching 1.0 means the false-positive rate has degraded well
   * beyond the configured target.
   */
  public get fillRatio(): number {
    let setBits = 0;
    for (let i = 0; i < this.bitArray.length; i++) {
      setBits += popcnt8(this.bitArray[i]);
    }
    return setBits / this.m;
  }

  /** Full construction-time configuration. */
  public getConfig(): BloomFilterConfig {
    return {
      m: this.m,
      k: this.k,
      seed: this.seed,
      expectedItems: this.expectedItems,
      falsePositiveRate: this.falsePositiveRate,
    };
  }

  // -----------------------------------------------------------------------
  // Serialization
  // -----------------------------------------------------------------------

  /** Serialize to a JSON-safe snapshot (config + base64 data). */
  public serialize(): BloomFilterSnapshot {
    return {
      config: this.getConfig(),
      data: Buffer.from(this.bitArray).toString("base64"),
    };
  }

  /**
   * Restore a filter from a snapshot produced by {@link serialize}.
   */
  public static deserialize(snapshot: BloomFilterSnapshot): BloomFilter {
    const { config, data } = snapshot;
    const filter = new BloomFilter(
      config.expectedItems,
      config.falsePositiveRate,
      config.seed,
    );

    if (filter.m !== config.m || filter.k !== config.k) {
      throw new Error(
        `Snapshot config mismatch: expected m=${filter.m}, k=${filter.k}; ` +
          `got m=${config.m}, k=${config.k}`,
      );
    }

    const buf = Buffer.from(data, "base64");
    if (buf.length !== filter.bitArray.length) {
      throw new Error(
        `Snapshot data length mismatch: expected ${filter.bitArray.length} bytes, got ${buf.length}`,
      );
    }

    filter.bitArray = new Uint8Array(buf);

    // Exact insert count is not recoverable from a serialized bit array.
    // NaN signals "unknown" — .size will return NaN, which is truthy-falsy
    // safe and clearly distinguishable from any valid count.
    filter.insertedCount = NaN;

    return filter;
  }

  // -----------------------------------------------------------------------
  // Hashing internals
  // -----------------------------------------------------------------------

  /**
   * Enhanced double-hashing:
   *   h_i(x) = ( h1(x) + i · h2(x) ) mod m
   *
   * All arithmetic uses unsigned 32-bit via `>>> 0` / `Math.imul` to avoid
   * precision loss when i is large.
   */
  private hashIndices(item: string): number[] {
    const h1 = xxh32(item, this.seed) >>> 0;
    const h2 = xxh32(item, h1) >>> 0;

    const indices: number[] = new Array(this.k);
    for (let i = 0; i < this.k; i++) {
      indices[i] = ((h1 + Math.imul(i, h2)) >>> 0) % this.m;
    }
    return indices;
  }
}
