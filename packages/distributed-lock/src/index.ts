import type { RedisClientType } from "redis";

// ---------------------------------------------------------------------------
// Lua Scripts — inlined to avoid filesystem / bundler / ESM path issues.
// ---------------------------------------------------------------------------

/**
 * RELEASE: atomically delete the key only if the caller is the current owner.
 *   KEYS[1] = lock key
 *   ARGV[1] = owner id
 *   Returns: 1 if deleted, 0 otherwise
 */
const RELEASE_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("DEL", KEYS[1])
else
    return 0
end
` as const;

/**
 * RENEW: atomically extend the TTL only if the caller is the current owner.
 *   KEYS[1] = lock key
 *   ARGV[1] = owner id
 *   ARGV[2] = new TTL in milliseconds (string)
 *   Returns: 1 if renewed, 0 otherwise
 */
const RENEW_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("PEXPIRE", KEYS[1], ARGV[2])
else
    return 0
end
` as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LockOptions {
  /** Redis key used as the lock. Consider namespacing (e.g. `lock:order:123`). */
  key: string;

  /** Globally unique owner identifier. Must be a UUID v4 or equivalent. */
  ownerId: string;

  /** Time-to-live for the lock in milliseconds. Must be > 0. */
  ttlMs: number;

  /**
   * Number of additional attempts after the first failure.
   * Total attempts = `retryCount + 1`. Default: `0` (single attempt).
   */
  retryCount?: number;

  /** Base delay between retries in milliseconds. Default: `200`. */
  retryDelayMs?: number;

  /**
   * When `true`, apply exponential back-off with jitter on retries:
   *   `delay = min(base * 2^attempt + random(0, base), maxRetryDelayMs)`
   * Default: `true`.
   */
  retryWithBackoff?: boolean;

  /** Upper bound for retry delay when back-off is enabled. Default: `5000` ms. */
  maxRetryDelayMs?: number;

  /**
   * When `true`, a background timer renews the lock at `ttlMs / 3` intervals.
   * The watchdog stops automatically on `release()` or when renewal fails
   * (lock expired / stolen). Default: `false`.
   */
  autoRenew?: boolean;
}

/** Handle returned on successful acquisition. */
export interface LockHandle {
  /** The Redis key for this lock. */
  readonly key: string;

  /** The owner identifier used when acquiring. */
  readonly ownerId: string;

  /**
   * Release the lock. Returns `true` if released, `false` if the lock was
   * already expired or held by a different owner.
   */
  release: () => Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function computeRetryDelay(
  attempt: number,
  baseDelay: number,
  maxDelay: number,
  useBackoff: boolean,
): number {
  if (!useBackoff) return baseDelay;
  const exponential = baseDelay * Math.pow(2, attempt);
  const jitter = Math.random() * baseDelay;
  return Math.min(exponential + jitter, maxDelay);
}

function validateOptions(opts: LockOptions): void {
  if (!opts.key) {
    throw new TypeError("Lock key must be a non-empty string");
  }
  if (!opts.ownerId) {
    throw new TypeError("Lock ownerId must be a non-empty string");
  }
  if (!Number.isFinite(opts.ttlMs) || opts.ttlMs <= 0) {
    throw new RangeError(`ttlMs must be a positive number, got ${opts.ttlMs}`);
  }
}

// ---------------------------------------------------------------------------
// DistributedLock
// ---------------------------------------------------------------------------

export class DistributedLock {
  private readonly redis: RedisClientType;

  /** Active watchdog timers keyed by lock key. */
  private readonly renewalTimers = new Map<
    string,
    ReturnType<typeof setInterval>
  >();

  constructor(redisClient: RedisClientType) {
    this.redis = redisClient;
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Attempt to acquire a distributed lock.
   *
   * @returns A {@link LockHandle} on success, or `null` if the lock could not
   *          be obtained within the configured retry budget.
   */
  public async acquire(options: LockOptions): Promise<LockHandle | null> {
    validateOptions(options);

    const {
      key,
      ownerId,
      ttlMs,
      retryCount = 0,
      retryDelayMs = 200,
      retryWithBackoff = true,
      maxRetryDelayMs = 5000,
      autoRenew = false,
    } = options;

    for (let attempt = 0; attempt <= retryCount; attempt++) {
      const result = await this.redis.set(key, ownerId, {
        PX: ttlMs,
        NX: true,
      });

      if (result === "OK") {
        if (autoRenew) {
          this.startRenewal(key, ownerId, ttlMs);
        }
        return Object.freeze<LockHandle>({
          key,
          ownerId,
          release: () => this.release(key, ownerId),
        });
      }

      // Don't sleep after the final attempt
      if (attempt < retryCount) {
        const delay = computeRetryDelay(
          attempt,
          retryDelayMs,
          maxRetryDelayMs,
          retryWithBackoff,
        );
        await sleep(delay);
      }
    }

    return null;
  }

  /**
   * Release a previously acquired lock.
   *
   * Prefer calling {@link LockHandle.release} instead of this method directly,
   * unless you only have the raw key / ownerId.
   *
   * @returns `true` if the lock was successfully released, `false` if it was
   *          already expired or held by a different owner.
   */
  public async release(key: string, ownerId: string): Promise<boolean> {
    this.stopRenewal(key);

    const result = await this.redis.eval(RELEASE_SCRIPT, {
      keys: [key],
      arguments: [ownerId],
    });
    return result === 1;
  }

  /**
   * Manually extend the TTL of a held lock.
   *
   * @returns `true` if renewed, `false` if the lock is expired or not owned.
   */
  public async renew(
    key: string,
    ownerId: string,
    ttlMs: number,
  ): Promise<boolean> {
    const result = await this.redis.eval(RENEW_SCRIPT, {
      keys: [key],
      arguments: [ownerId, ttlMs.toString()],
    });
    return result === 1;
  }

  /**
   * Stop **all** active watchdog timers. Call during graceful shutdown
   * (e.g. `process.on("SIGTERM", …)`).
   */
  public stopAllRenewals(): void {
    for (const [, timer] of this.renewalTimers) {
      clearInterval(timer);
    }
    this.renewalTimers.clear();
  }

  // -----------------------------------------------------------------------
  // Watchdog internals
  // -----------------------------------------------------------------------

  private startRenewal(key: string, ownerId: string, ttlMs: number): void {
    this.stopRenewal(key);

    // Renew at 1/3 of the TTL — ensures at least 2 chances before expiry.
    const interval = Math.max(Math.floor(ttlMs / 3), 100);

    const timer = setInterval(async () => {
      try {
        const ok = await this.renew(key, ownerId, ttlMs);
        if (!ok) {
          // Lock lost (expired / stolen) — stop silently.
          this.stopRenewal(key);
        }
      } catch {
        // Redis error — stop to prevent silent infinite failures.
        this.stopRenewal(key);
      }
    }, interval);

    // Allow the Node.js event loop to exit even if the timer is still active.
    if (typeof timer === "object" && "unref" in timer) {
      timer.unref();
    }

    this.renewalTimers.set(key, timer);
  }

  private stopRenewal(key: string): void {
    const timer = this.renewalTimers.get(key);
    if (timer !== undefined) {
      clearInterval(timer);
      this.renewalTimers.delete(key);
    }
  }
}
